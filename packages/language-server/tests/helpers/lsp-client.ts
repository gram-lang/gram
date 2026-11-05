import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/*
 * A just-enough LSP client for the end-to-end tests: the built language server
 * is started as a process and spoken to over stdio, the way VS Code does.
 */

const SERVER = join(import.meta.dir, "..", "..", "dist", "server.cjs");

export const URI = "file:///tmp/gram-mise-en-place/a.gram";
export const ROOT = "file:///tmp/gram-mise-en-place";

export interface Note {
	method: string;
	params: { uri?: string; html?: string } & Record<string, unknown>;
}

/** A just-enough LSP client: frames, requests, and the `gram/*` notifications. */
export class Client {
	private server: ChildProcess;
	private buffer = Buffer.alloc(0);
	private nextId = 1;
	private pending = new Map<number, (result: unknown) => void>();
	readonly notes: Note[] = [];
	/** What the client answers to `workspace/configuration`. */
	setting: unknown = "perSection";
	/** And to `gram.rests`. */
	rests: unknown = "shortest";
	/** And to `gram.comments`. */
	comments: unknown = "show";
	/** Any other `gram.*` setting. */
	extra: Record<string, unknown> = {};
	/** How long the client takes to answer it (ms). */
	configDelay = 0;

	constructor() {
		if (!existsSync(SERVER)) {
			throw new Error(
				`${SERVER} is missing: build the language server first (bun run build).`,
			);
		}
		this.server = spawn("node", [SERVER, "--stdio"], {
			stdio: ["pipe", "pipe", "ignore"],
		});
		this.server.stdout?.on("data", (chunk: Buffer) => this.onData(chunk));
	}

	private onData(chunk: Buffer) {
		this.buffer = Buffer.concat([this.buffer, chunk]);
		for (;;) {
			const end = this.buffer.indexOf("\r\n\r\n");
			if (end < 0) return;
			const length = Number(
				/Content-Length: (\d+)/.exec(
					this.buffer.subarray(0, end).toString(),
				)?.[1],
			);
			if (this.buffer.length < end + 4 + length) return;
			const message = JSON.parse(
				this.buffer.subarray(end + 4, end + 4 + length).toString(),
			);
			this.buffer = this.buffer.subarray(end + 4 + length);
			this.dispatch(message);
		}
	}

	private dispatch(message: {
		id?: number;
		method?: string;
		params?: { items?: unknown[] } & Note["params"];
		result?: unknown;
	}) {
		if (message.method === "workspace/configuration") {
			const items = message.params?.items ?? [];
			// Read at the moment of answering: a setting changed meanwhile wins.
			setTimeout(
				() =>
					this.write({
						id: message.id,
						result: items.map(() => ({
							miseEnPlace: this.setting,
							rests: this.rests,
							comments: this.comments,
							...this.extra,
						})),
					}),
				this.configDelay,
			);
		} else if (message.method && message.id !== undefined) {
			this.write({ id: message.id, result: null }); // any other request from the server
		} else if (message.method) {
			this.notes.push(message as Note);
		} else if (message.id !== undefined) {
			this.pending.get(message.id)?.(message.result);
			this.pending.delete(message.id);
		}
	}

	private write(message: object) {
		const body = JSON.stringify({ jsonrpc: "2.0", ...message });
		this.server.stdin?.write(
			`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`,
		);
	}

	notify(method: string, params: object) {
		this.write({ method, params });
	}

	request(method: string, params: object): Promise<unknown> {
		const id = this.nextId++;
		return new Promise((resolve) => {
			this.pending.set(id, resolve);
			this.write({ id, method, params });
		});
	}

	/** `initializationOptions`: `{ views: true }` for a client of the views protocol. */
	async start(initializationOptions?: object) {
		await this.request("initialize", {
			processId: null,
			...(initializationOptions && { initializationOptions }),
			rootUri: ROOT,
			capabilities: { workspace: { configuration: true } },
			workspaceFolders: [{ uri: ROOT, name: "gram" }],
		});
		this.notify("initialized", {});
	}

	open(text: string, uri = URI) {
		this.notify("textDocument/didOpen", {
			textDocument: { uri, languageId: "gram", version: 1, text },
		});
	}

	change(text: string, version: number, uri = URI) {
		this.notify("textDocument/didChange", {
			textDocument: { uri, version },
			contentChanges: [{ text }],
		});
	}

	settingChanged() {
		this.notify("workspace/didChangeConfiguration", { settings: {} });
	}

	previews(): string[] {
		return this.notes
			.filter((n) => n.method === "gram/previewUpdated")
			.map((n) => n.params.html ?? "");
	}

	/** Resolves with the first notification of `method` whose html matches. */
	async htmlOf(method: string, test: (html: string) => boolean, ms = 8000) {
		const started = Date.now();
		while (Date.now() - started < ms) {
			const hit = this.notes
				.filter((n) => n.method === method)
				.map((n) => n.params.html ?? "")
				.find(test);
			if (hit) return hit;
			await new Promise((r) => setTimeout(r, 25));
		}
		throw new Error(`no ${method} matching in ${ms}ms`);
	}

	/** Resolves as soon as a preview matches; fails with what it saw otherwise. */
	async previewMatching(test: (html: string) => boolean, ms = 8000) {
		const started = Date.now();
		while (Date.now() - started < ms) {
			const hit = this.previews().find(test);
			if (hit) return hit;
			await new Promise((r) => setTimeout(r, 25));
		}
		throw new Error(
			`no matching preview in ${ms}ms; saw: ${this.previews()
				.map((h) => /<h1[^>]*>([^<]*)</.exec(h)?.[1] ?? h.slice(0, 60))
				.join(" | ")}`,
		);
	}

	/** Waits until no notification has arrived for `quietMs`. */
	async settle(quietMs = 500, max = 8000) {
		const started = Date.now();
		let seen = -1;
		let since = Date.now();
		while (Date.now() - started < max) {
			if (this.notes.length !== seen) {
				seen = this.notes.length;
				since = Date.now();
			} else if (Date.now() - since >= quietMs) return;
			await new Promise((r) => setTimeout(r, 25));
		}
	}

	stop() {
		this.server.kill();
	}
}

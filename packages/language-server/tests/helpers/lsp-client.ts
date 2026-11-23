import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/*
 * A just-enough LSP client for the end-to-end tests: the built language server
 * is started as a process and spoken to over stdio, the way VS Code does.
 */

export const SERVER = join(import.meta.dir, "..", "..", "dist", "server.cjs");

export const URI = "file:///tmp/gram-mise-en-place/a.gram";
export const ROOT = "file:///tmp/gram-mise-en-place";

export interface Note {
	method: string;
	params: { uri?: string; html?: string } & Record<string, unknown>;
}

/** How the server is launched: `node dist/server.cjs --stdio` by default. */
export interface Spawn {
	command?: string;
	args?: string[];
}

/** What `start` sends besides the initialization options. */
export interface StartOptions {
	/** What the client declares (by default, only `workspace/configuration`). */
	capabilities?: object;
	/** The workspace root (by default, `ROOT`). */
	root?: string;
	/** Send `rootUri` alone, without `workspaceFolders`, as older clients do. */
	rootOnly?: boolean;
}

interface Diagnostic {
	message: string;
	severity?: number;
}

// A header block of the base protocol: `Content-Length`, then an optional
// `Content-Type`. Anything else on stdout is a byte that leaked into the stream.
const HEADER = /^Content-Length: (\d+)(\r\nContent-Type: [^\r\n]*)?$/;

/** A just-enough LSP client: frames, requests, and the `gram/*` notifications. */
export class Client {
	private server: ChildProcess;
	private buffer = Buffer.alloc(0);
	private nextId = 1;
	private pending = new Map<
		number,
		{ resolve: (result: unknown) => void; reject: (error: Error) => void }
	>();
	private closed: Promise<number | null>;
	/** The first chunk the server wrote on stdout, as raw bytes. */
	firstChunk: Buffer | undefined;
	/** Every header block that was not a well-formed `Content-Length` header. */
	readonly streamErrors: string[] = [];
	readonly notes: Note[] = [];
	/** Every request the server sent to the client, in order. */
	readonly requests: { id: number; method: string; params?: unknown }[] = [];
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

	constructor({ command = "node", args = [SERVER, "--stdio"] }: Spawn = {}) {
		if (!existsSync(SERVER)) {
			throw new Error(
				`${SERVER} is missing: build the language server first (bun run build).`,
			);
		}
		this.server = spawn(command, args, {
			stdio: ["pipe", "pipe", "ignore"],
		});
		this.server.stdout?.on("data", (chunk: Buffer) => this.onData(chunk));
		this.closed = new Promise((resolve) =>
			this.server.on("close", (code) => resolve(code)),
		);
	}

	private onData(chunk: Buffer) {
		this.firstChunk ??= chunk;
		this.buffer = Buffer.concat([this.buffer, chunk]);
		for (;;) {
			const end = this.buffer.indexOf("\r\n\r\n");
			if (end < 0) return;
			const header = this.buffer.subarray(0, end).toString();
			if (!HEADER.test(header)) this.streamErrors.push(header);
			const length = Number(/Content-Length: (\d+)/.exec(header)?.[1]);
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
		error?: { message: string };
	}) {
		if (message.method && message.id !== undefined) {
			this.requests.push({
				id: message.id,
				method: message.method,
				params: message.params,
			});
		}
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
			const pending = this.pending.get(message.id);
			this.pending.delete(message.id);
			if (message.error) pending?.reject(new Error(message.error.message));
			else pending?.resolve(message.result);
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
		return new Promise((resolve, reject) => {
			this.pending.set(id, { resolve, reject });
			this.write({ id, method, params });
		});
	}

	/**
	 * `initializationOptions`: `{ views: true }` for a client of the views
	 * protocol, `{ views: false }` for an editor with no views.
	 */
	async start(
		initializationOptions?: object,
		{
			capabilities = { workspace: { configuration: true } },
			root = ROOT,
			rootOnly = false,
		}: StartOptions = {},
	): Promise<unknown> {
		const result = await this.request("initialize", {
			processId: null,
			...(initializationOptions && { initializationOptions }),
			rootUri: root,
			capabilities,
			...(!rootOnly && { workspaceFolders: [{ uri: root, name: "gram" }] }),
		});
		this.notify("initialized", {});
		return result;
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

	hover(line: number, character: number, uri = URI) {
		return this.request("textDocument/hover", {
			textDocument: { uri },
			position: { line, character },
		}) as Promise<{ contents: { value: string } } | null>;
	}

	completion(line: number, character: number, uri = URI) {
		return this.request("textDocument/completion", {
			textDocument: { uri },
			position: { line, character },
		}) as Promise<{ label: string }[] | { items: { label: string }[] } | null>;
	}

	format(uri = URI) {
		return this.request("textDocument/formatting", {
			textDocument: { uri },
			options: { tabSize: 2, insertSpaces: true },
		}) as Promise<{ newText: string }[] | null>;
	}

	semanticTokens(uri = URI) {
		return this.request("textDocument/semanticTokens/full", {
			textDocument: { uri },
		}) as Promise<{ data: number[] } | null>;
	}

	/** Resolves with the latest diagnostics of `uri` that pass `test`. */
	async diagnosticsOf(
		uri = URI,
		test: (diagnostics: Diagnostic[]) => boolean = () => true,
		ms = 8000,
	): Promise<Diagnostic[]> {
		const started = Date.now();
		while (Date.now() - started < ms) {
			const hit = this.notes
				.filter(
					(n) =>
						n.method === "textDocument/publishDiagnostics" &&
						n.params.uri === uri,
				)
				.map((n) => n.params.diagnostics as Diagnostic[])
				.findLast(test);
			if (hit) return hit;
			await new Promise((r) => setTimeout(r, 25));
		}
		throw new Error(`no matching diagnostics for ${uri} in ${ms}ms`);
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

	/** Tells the server which outputs of `uri` are open (views protocol). */
	openViews(viewIds: string[], uri = URI) {
		this.notify("gram/setOpenViews", { uri, viewIds });
	}

	/** The HTML of every `gram/viewUpdated` of `outputId` sent with `state: "ok"`. */
	views(outputId: string): string[] {
		return this.notes
			.filter(
				(n) =>
					n.method === "gram/viewUpdated" &&
					n.params.outputId === outputId &&
					n.params.state === "ok" &&
					typeof n.params.payload === "string",
			)
			.map((n) => n.params.payload as string);
	}

	/** Resolves with the first HTML of `outputId` that matches. */
	async viewHtml(outputId: string, test: (html: string) => boolean, ms = 8000) {
		const started = Date.now();
		while (Date.now() - started < ms) {
			const hit = this.views(outputId).find(test);
			if (hit) return hit;
			await new Promise((r) => setTimeout(r, 25));
		}
		throw new Error(`no ${outputId} view matching in ${ms}ms`);
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

	/**
	 * Ends the session as the protocol does: `shutdown`, its answer, then
	 * `exit`. Resolves with the server's exit code.
	 */
	async shutdown(): Promise<number | null> {
		await this.request("shutdown", {});
		this.notify("exit", {});
		return this.closed;
	}

	stop() {
		this.server.kill();
	}
}

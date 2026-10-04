import { afterEach, describe, expect, it } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { compile, scheduleTimes } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";

/*
 * The `gram.miseEnPlace` setting, end to end: the built language server is
 * started as a process and spoken to over LSP, the way VS Code does. What is
 * checked is when, and with what, the preview is re-rendered. Unit tests can't
 * see this: the behaviour lives in how `server.ts` wires the connection.
 */

const SERVER = join(import.meta.dir, "..", "dist", "server.cjs");

const RECIPE = (title: string) => `---
title: ${title}
---

## Pastry ~{-2d}

Mix @flour{200g}(sifted).

## Assembly

Combine the pastry with @filling{300g}.
`;

// The retro-planning offset makes the two schedules give different totals.
const compiled = compile(getAST(RECIPE("Tart")));
const fmt = (minutes: number) =>
	`${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
const TOTAL = {
	perSection: fmt(scheduleTimes(compiled, "perSection").totalTime),
	upfront: fmt(scheduleTimes(compiled, "upfront").totalTime),
};

const URI = "file:///tmp/gram-mise-en-place/a.gram";
const ROOT = "file:///tmp/gram-mise-en-place";

interface Note {
	method: string;
	params: { uri?: string; html?: string };
}

/** A just-enough LSP client: frames, requests, and the `gram/*` notifications. */
class Client {
	private server: ChildProcess;
	private buffer = Buffer.alloc(0);
	private nextId = 1;
	private pending = new Map<number, (result: unknown) => void>();
	readonly notes: Note[] = [];
	/** What the client answers to `workspace/configuration`. */
	setting: unknown = "perSection";
	/** And to `gram.rests`. */
	rests: unknown = "shortest";
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

	async start() {
		await this.request("initialize", {
			processId: null,
			rootUri: ROOT,
			capabilities: { workspace: { configuration: true } },
			workspaceFolders: [{ uri: ROOT, name: "gram" }],
		});
		this.notify("initialized", {});
	}

	open(text: string) {
		this.notify("textDocument/didOpen", {
			textDocument: { uri: URI, languageId: "gram", version: 1, text },
		});
	}

	change(text: string, version: number) {
		this.notify("textDocument/didChange", {
			textDocument: { uri: URI, version },
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

	/** Resolves as soon as a preview matches; fails with what it saw otherwise. */
	async previewMatching(test: (html: string) => boolean, ms = 8000) {
		const started = Date.now();
		while (Date.now() - started < ms) {
			const hit = this.previews().find(test);
			if (hit) return hit;
			await new Promise((r) => setTimeout(r, 25));
		}
		throw new Error(
			`no matching preview in ${ms}ms; saw: ${this.previews().map(summary).join(" | ")}`,
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

const totalOf = (html: string) =>
	/Total Time<\/div>\s*<div class="meta-value">([^<]+)</.exec(
		html.replace(/<svg[\s\S]*?<\/svg>/g, ""),
	)?.[1];
const titleOf = (html: string) => /<h1[^>]*>([^<]*)</.exec(html)?.[1];
const summary = (html: string) => `${titleOf(html)}/${totalOf(html)}`;

let client: Client | undefined;
afterEach(() => client?.stop());

describe("gram.miseEnPlace in the language server", () => {
	it("sanity: the two schedules do not give the same total", () => {
		expect(TOTAL.upfront).not.toBe(TOTAL.perSection);
	});

	it("renders by section until told otherwise", async () => {
		client = new Client();
		await client.start();
		client.open(RECIPE("Tart"));
		const html = await client.previewMatching((h) => totalOf(h) !== undefined);
		expect(totalOf(html)).toBe(TOTAL.perSection);
	}, 20_000);

	it("applies the setting to a recipe already open when it arrives", async () => {
		client = new Client();
		client.setting = "upfront";
		client.configDelay = 300; // the recipe is opened well before the answer
		await client.start();
		client.open(RECIPE("Tart"));
		// No edit, nothing else: the preview has to catch up by itself.
		const html = await client.previewMatching(
			(h) => totalOf(h) === TOTAL.upfront,
		);
		expect(titleOf(html)).toBe("Tart");
	}, 20_000);

	it("re-renders every open recipe when the setting changes", async () => {
		client = new Client();
		await client.start();
		client.open(RECIPE("Tart"));
		await client.previewMatching((h) => totalOf(h) === TOTAL.perSection);

		client.setting = "upfront";
		client.settingChanged();
		await client.previewMatching((h) => totalOf(h) === TOTAL.upfront);

		const hints = (await client.request("textDocument/inlayHint", {
			textDocument: { uri: URI },
			range: {
				start: { line: 0, character: 0 },
				end: { line: 20, character: 0 },
			},
		})) as Array<{ label: string }>;
		const hint = hints.map((h) => h.label).join("");
		expect(hint).toContain(
			`Total Time: ${TOTAL.upfront.replace(/ (\d+)m/, "$1")}`,
		);
	}, 20_000);

	it("ends on the newest text and the new schedule when a keystroke is still pending", async () => {
		client = new Client();
		await client.start();
		client.open(RECIPE("Old"));
		await client.previewMatching((h) => titleOf(h) === "Old");

		// An edit waits in the 150 ms debounce when the setting changes.
		client.setting = "upfront";
		client.change(RECIPE("New"), 2);
		client.settingChanged();

		await client.previewMatching(
			(h) => titleOf(h) === "New" && totalOf(h) === TOTAL.upfront,
		);
		await client.settle();
		const last = client.previews().at(-1) ?? "";
		expect(summary(last)).toBe(`New/${TOTAL.upfront}`);
	}, 20_000);

	it("falls back on the default for a value it does not know", async () => {
		client = new Client();
		client.setting = "sideways";
		await client.start();
		client.open(RECIPE("Tart"));
		const html = await client.previewMatching((h) => totalOf(h) !== undefined);
		expect(totalOf(html)).toBe(TOTAL.perSection);
	}, 20_000);
});

// A rest written as a range: the choice of rests moves the total, and nothing
// else here does.
const RANGED = (title: string) => `---
title: ${title}
---

## Dough ->&dough

Knead @flour{500g} ~{20min}, then rest ~_{8-16h}.

## Bake

Bake &dough{500g} ~{30min}.
`;
const ranged = compile(getAST(RANGED("Bread")));
const REST_TOTAL = {
	shortest: fmt(scheduleTimes(ranged, undefined, "shortest").totalTime),
	longest: fmt(scheduleTimes(ranged, undefined, "longest").totalTime),
};

describe("gram.rests in the language server", () => {
	it("sanity: the shortest and the longest rests do not give the same total", () => {
		expect(REST_TOTAL.longest).not.toBe(REST_TOTAL.shortest);
	});

	it("renders with the shortest rests until told otherwise", async () => {
		client = new Client();
		await client.start();
		client.open(RANGED("Bread"));
		const html = await client.previewMatching((h) => totalOf(h) !== undefined);
		expect(totalOf(html)).toBe(REST_TOTAL.shortest);
	}, 20_000);

	it("applies the setting to a recipe already open, and re-renders when it changes", async () => {
		client = new Client();
		client.rests = "longest";
		client.configDelay = 300;
		await client.start();
		client.open(RANGED("Bread"));
		await client.previewMatching((h) => totalOf(h) === REST_TOTAL.longest);

		client.rests = "shortest";
		client.settingChanged();
		await client.previewMatching((h) => totalOf(h) === REST_TOTAL.shortest);
	}, 20_000);

	it("falls back on the shortest for a value it does not know", async () => {
		client = new Client();
		client.rests = "sideways";
		await client.start();
		client.open(RANGED("Bread"));
		const html = await client.previewMatching((h) => totalOf(h) !== undefined);
		expect(totalOf(html)).toBe(REST_TOTAL.shortest);
	}, 20_000);
});

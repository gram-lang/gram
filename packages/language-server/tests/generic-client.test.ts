import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Client, SERVER } from "./helpers/lsp-client";

/*
 * The contract of every editor that is not VS Code (Neovim, Helix, Emacs...):
 * the `gram-language-server` binary over stdio, `views: false`, no workspace
 * capability, `rootUri` alone. The editing features work; nothing the client
 * did not ask for reaches it, and nothing but frames reaches stdout.
 */

const TITLE = "---\ntitle: Bread\n---\n\n";

const RECIPE = `${TITLE}## Dough

Mix @flour{200g} with @water{120g}.
`;

// Does not parse: a composite without its opening ingredient.
const BROKEN = `## Section
@ <@parent
`;

let root: string;
let uri: string;

beforeAll(() => {
	root = mkdtempSync(join(tmpdir(), "gram-generic-client-"));
	mkdirSync(join(root, ".gram"));
	writeFileSync(
		join(root, ".gram", "ingredients.yaml"),
		"flour:\n  name: Wheat flour\nwater:\n  name: Water\n",
	);
	uri = pathToFileURL(join(root, "bread.gram")).href;
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

/** The binary itself, with `args`, as an editor runs it. */
async function startGeneric(args: string[]) {
	const client = new Client({ command: SERVER, args });
	const result = (await client.start(
		{ views: false },
		{ capabilities: {}, root: pathToFileURL(root).href, rootOnly: true },
	)) as { capabilities: Record<string, unknown> };
	return { client, capabilities: result.capabilities };
}

async function until<T>(
	read: () => Promise<T>,
	test: (value: T) => boolean,
	ms = 8000,
): Promise<T> {
	const started = Date.now();
	for (;;) {
		const value = await read();
		if (test(value)) return value;
		if (Date.now() - started > ms) throw new Error(`timed out after ${ms}ms`);
		await new Promise((r) => setTimeout(r, 50));
	}
}

let client: Client | undefined;
afterEach(() => client?.stop());

describe("a generic stdio client", () => {
	for (const args of [["--stdio"], []]) {
		it(`gets only frames on stdout, from the first byte (${args.length ? args.join(" ") : "no argument"})`, async () => {
			({ client } = await startGeneric(args));
			expect(client.firstChunk?.toString().startsWith("Content-Length: ")).toBe(
				true,
			);
			// A document that neither parses nor compiles: whatever the server
			// logs about it must go through window/logMessage, not stdout.
			client.open(BROKEN, uri);
			await client.diagnosticsOf(uri, (d) => d.length > 0);
			client.change(RECIPE, 2, uri);
			await client.diagnosticsOf(uri, (d) => d.length === 0);
			await client.settle();
			expect(client.streamErrors).toEqual([]);
		}, 20_000);
	}

	it("gets the editing features", async () => {
		({ client } = await startGeneric(["--stdio"]));

		client.open(BROKEN, uri);
		const diagnostics = await client.diagnosticsOf(uri, (d) => d.length > 0);
		expect(diagnostics[0]?.message).toBeTruthy();

		client.change(RECIPE, 2, uri);
		await client.diagnosticsOf(uri, (d) => d.length === 0);

		// Known only from the database of the rootUri folder: proof that the
		// server falls back to rootUri without workspace folders.
		const hover = await until(
			() => (client as Client).hover(6, 6, uri),
			(h) => h !== null,
		);
		expect(hover?.contents.value).toContain("Wheat flour");

		client.change(`${RECIPE}\nAdd @`, 3, uri);
		const completion = await until(
			() => (client as Client).completion(8, 5, uri),
			(c) => c !== null,
		);
		const items = Array.isArray(completion) ? completion : completion.items;
		expect(items.map((i) => i.label)).toContain("Wheat flour");

		client.change(`${TITLE}## Dough\n\nMix @flour{ 200 g }.\n`, 4, uri);
		const edits = await until(
			() => (client as Client).format(uri),
			(e) => (e ?? []).length > 0,
		);
		expect(edits?.map((e) => e.newText).join("")).toContain("@flour{200 g}");

		const tokens = await (client as Client).semanticTokens(uri);
		expect(tokens?.data.length).toBeGreaterThan(0);
	}, 20_000);

	it("gets nothing it did not ask for", async () => {
		let capabilities: Record<string, unknown>;
		({ client, capabilities } = await startGeneric(["--stdio"]));
		expect(capabilities.codeLensProvider).toBeUndefined();
		expect(capabilities.experimental).toBeUndefined();

		client.open(RECIPE, uri);
		await client.diagnosticsOf(uri);
		client.change(`${RECIPE}\nKnead.\n`, 2, uri);
		await client.settle();

		expect(client.notes.filter((n) => n.method.startsWith("gram/"))).toEqual(
			[],
		);
		expect(client.requests.map((r) => r.method)).not.toContainAnyValues([
			"client/registerCapability",
			"workspace/configuration",
			"workspace/inlayHint/refresh",
		]);
	}, 20_000);

	it("exits with 0 after shutdown and exit", async () => {
		({ client } = await startGeneric([]));
		client.open(RECIPE, uri);
		await client.diagnosticsOf(uri);
		expect(await client.shutdown()).toBe(0);
	}, 20_000);
});

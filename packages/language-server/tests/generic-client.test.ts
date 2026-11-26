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

	it("gets the @use links, the highlights and the export completion", async () => {
		const base = pathToFileURL(join(root, "bases", "pate.gram")).href;
		const tarte = pathToFileURL(join(root, "tarte.gram")).href;
		mkdirSync(join(root, "bases"), { recursive: true });
		writeFileSync(
			join(root, "bases", "pate.gram"),
			"## Pâte ->&pate\n\n[Mix] @flour{200g}.\n\n## Crème ->&creme\n\n[Whip] @water{10cl}.\n",
		);
		const text = `@use "./bases/pate.gram" as { &pate }\n\n## Tarte\n\nLine with &pate, then &pate{}.\n`;
		let capabilities: Record<string, unknown>;
		({ client, capabilities } = await startGeneric(["--stdio"]));
		expect(capabilities.documentLinkProvider).toEqual({
			resolveProvider: false,
		});
		expect(capabilities.documentHighlightProvider).toBe(true);

		client.open(text, tarte);
		await client.diagnosticsOf(tarte);
		const links = (await until(
			() =>
				(client as Client).request("textDocument/documentLink", {
					textDocument: { uri: tarte },
				}),
			(l) => Array.isArray(l) && l.length > 0,
		)) as { target: string }[];
		expect(links.map((l) => l.target)).toEqual([base]);

		const highlights = (await (client as Client).request(
			"textDocument/documentHighlight",
			{ textDocument: { uri: tarte }, position: { line: 4, character: 12 } },
		)) as unknown[];
		expect(highlights).toHaveLength(3);

		// Mid-typing, the line does not parse: the exports come from the base.
		client.change(text.replace("{ &pate }", "{ &pate, &"), 2, tarte);
		const completion = (await (client as Client).completion(
			0,
			'@use "./bases/pate.gram" as { &pate, &'.length,
			tarte,
		)) as { label: string }[];
		expect(completion.map((i) => i.label)).toEqual(["creme"]);
	}, 20_000);

	it("gets the frontmatter keys, the recipe's names and the deprecated key's fix", async () => {
		const file = pathToFileURL(join(root, "cookies.gram")).href;
		const text =
			"---\ntitle: Cookies\nservings: 4\n---\n\n## Bake\n\nHeat the #pan{} in ~_oven{10 min}.\n";
		let capabilities: Record<string, unknown>;
		({ client, capabilities } = await startGeneric(["--stdio"]));
		expect(capabilities.completionProvider).toEqual({
			triggerCharacters: ["&", "@", '"', "#", "^", "~"],
		});

		client.open(text, file);
		const deprecated = (
			await client.diagnosticsOf(file, (d) =>
				d.some((x) => x.code === "DEPRECATED_FRONTMATTER_KEY"),
			)
		).find((x) => x.code === "DEPRECATED_FRONTMATTER_KEY");
		const diag = deprecated as unknown as {
			range: { start: { line: number; character: number } };
			tags?: number[];
		};
		expect(diag.range.start).toEqual({ line: 2, character: 0 });
		expect(diag.tags).toEqual([2]); // DiagnosticTag.Deprecated

		const actions = (await (client as Client).request(
			"textDocument/codeAction",
			{
				textDocument: { uri: file },
				range: diag.range,
				context: { diagnostics: [deprecated] },
			},
		)) as { title: string; isPreferred?: boolean }[];
		expect(actions).toContainEqual(
			expect.objectContaining({
				title: "Rename 'servings' to 'portions'",
				isPreferred: true,
			}),
		);

		const hover = await (client as Client).hover(1, 2, file);
		expect(hover?.contents.value).toContain("**`title`**");

		// A key being typed, before the block is closed.
		client.change("---\ntitle: Cookies\nport", 2, file);
		const keys = (await (client as Client).completion(2, 4, file)) as {
			label: string;
		}[];
		expect(keys.map((i) => i.label)).toContain("portions");
		expect(keys.map((i) => i.label)).not.toContain("title");

		client.change(`${text}\nThen ~_`, 3, file);
		const tracks = (await until(
			() => (client as Client).completion(9, 7, file),
			(c) => Array.isArray(c) && c.length > 0,
		)) as { label: string }[];
		expect(tracks.map((i) => i.label)).toEqual(["oven"]);
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

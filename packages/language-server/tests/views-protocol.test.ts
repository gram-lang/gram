import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { DEFAULT_RECIPE_SETTINGS, outputs } from "@gram-lang/renderer";
import { Client, type Note, URI } from "./helpers/lsp-client";

/*
 * The views protocol, end to end: `gram/setOpenViews`, `gram/setSession` and
 * `gram/viewUpdated`, spoken to the built language server as VS Code does.
 */

const TART = (title: string) => `---
title: ${title}
---

## Pastry ~{-2d}

Mix @flour{200g}(sifted).

## Assembly

Combine the pastry with @filling{300g}.
`;

// Does not parse: a composite without its opening ingredient.
const BROKEN = `## Section
@ <@parent
`;

interface Update {
	uri: string;
	outputId: string;
	kind: string;
	state: "ok" | "paused";
	payload?: unknown;
	error?: { title: string; code?: string };
}

const updatesOf = (client: Client): Update[] =>
	client.notes
		.filter((n: Note) => n.method === "gram/viewUpdated")
		.map((n) => n.params as unknown as Update);

async function waitFor(
	client: Client,
	test: (u: Update) => boolean,
	ms = 8000,
): Promise<Update> {
	const started = Date.now();
	while (Date.now() - started < ms) {
		const hit = updatesOf(client).find(test);
		if (hit) return hit;
		await new Promise((r) => setTimeout(r, 25));
	}
	throw new Error(
		`no matching gram/viewUpdated in ${ms}ms; saw: ${updatesOf(client)
			.map((u) => `${u.outputId}:${u.state}`)
			.join(" | ")}`,
	);
}

/** Waits until no gram/viewUpdated has arrived for `ms`. */
async function quiet(client: Client, ms = 500): Promise<void> {
	let count = -1;
	while (count !== updatesOf(client).length) {
		count = updatesOf(client).length;
		await new Promise((r) => setTimeout(r, ms));
	}
}

const htmlIs = (id: string, test: (html: string) => boolean) => (u: Update) =>
	u.outputId === id &&
	u.state === "ok" &&
	typeof u.payload === "string" &&
	test(u.payload);

let client: Client | undefined;
afterEach(() => client?.stop());

describe("the views protocol", () => {
	it("lists every output in the initialize result, named in the editor's language", async () => {
		client = new Client();
		const result = (await client.start({ views: true })) as {
			capabilities: {
				experimental?: {
					gramViews?: { outputs: { id: string; label: string }[] };
				};
			};
		};
		const listed = result.capabilities.experimental?.gramViews?.outputs ?? [];
		expect(listed.map((o) => o.id)).toEqual(outputs.map((o) => o.id));
		expect(listed.find((o) => o.id === "runSheet")?.label).toBe("Run sheet");
	}, 20_000);

	it("says what each view reads, and the words of the serving time controls", async () => {
		client = new Client();
		const result = (await client.start({ views: true })) as {
			capabilities: {
				experimental?: {
					gramViews?: {
						outputs: { id: string; needs?: string[] }[];
						strings: { serving?: Record<string, string> };
					};
				};
			};
		};
		const views = result.capabilities.experimental?.gramViews;
		for (const output of outputs) {
			const listed = views?.outputs.find((o) => o.id === output.id);
			if (output.kind === "renderer") {
				expect(listed?.needs).toEqual([...output.needs]);
			} else {
				expect(listed?.needs).toBeUndefined();
			}
		}
		expect(views?.strings.serving?.label).toBe("Served at");
	}, 20_000);

	it("proposes serving times for a document on gram/serveTimes", async () => {
		client = new Client();
		await client.start({ views: true });
		client.open(TART("Tart"));
		client.notify("gram/setOpenViews", { uri: URI, viewIds: ["runSheet"] });
		await waitFor(client, (u) => u.outputId === "runSheet");
		const suggestions = (await client.request("gram/serveTimes", {
			uri: URI,
		})) as {
			candidates: { serveAt: string; label: string; title: string }[];
			earliest: { serveAt: string; text: string } | null;
		} | null;
		expect(suggestions?.candidates.length).toBeGreaterThan(0);
		expect(suggestions?.candidates[0]?.serveAt).toMatch(
			/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
		);
		expect(suggestions?.earliest?.text).toBeString();
		expect(
			await client.request("gram/serveTimes", { uri: "file:///nowhere.gram" }),
		).toBeNull();
	}, 20_000);

	it("sends nothing to a views client until it says what is open", async () => {
		client = new Client();
		await client.start({ views: true });
		client.open(TART("Tart"));
		await client.settle();
		expect(updatesOf(client)).toEqual([]);
		// Nor the old notifications: they are for older clients.
		expect(client.previews()).toEqual([]);
	}, 20_000);

	it("renders what is open, and only that, now and on every edit", async () => {
		client = new Client();
		await client.start({ views: true });
		client.open(TART("Tart"));
		client.notify("gram/setOpenViews", { uri: URI, viewIds: ["runSheet"] });
		await waitFor(
			client,
			htmlIs("runSheet", (h) => h.includes("Run sheet — Tart")),
		);

		client.change(TART("Pie"), 2);
		await waitFor(
			client,
			htmlIs("runSheet", (h) => h.includes("Run sheet — Pie")),
		);
		await client.settle();
		expect(new Set(updatesOf(client).map((u) => u.outputId))).toEqual(
			new Set(["runSheet"]),
		);
	}, 20_000);

	it("sends an inspector as text for its pane", async () => {
		client = new Client();
		await client.start({ views: true });
		client.open(TART("Tart"));
		client.notify("gram/setOpenViews", { uri: URI, viewIds: ["json"] });
		const json = await waitFor(client, (u) => u.outputId === "json");
		expect(json).toMatchObject({ kind: "inspector", state: "ok" });
		const payload = json.payload as { language: string; text: string };
		expect(payload.language).toBe("json");
		expect(JSON.parse(payload.text).title).toBe("Tart");
	}, 20_000);

	it("pauses the open outputs when the recipe stops parsing, then resumes", async () => {
		client = new Client();
		await client.start({ views: true });
		client.open(TART("Tart"));
		client.notify("gram/setOpenViews", { uri: URI, viewIds: ["recipe"] });
		await waitFor(
			client,
			htmlIs("recipe", (h) => h.includes("Tart")),
		);

		client.change(BROKEN, 2);
		const paused = await waitFor(client, (u) => u.state === "paused");
		expect(paused.error?.code).toBe("PARSE_ERROR");
		expect(paused).not.toHaveProperty("payload");

		client.change(TART("Back"), 3);
		await waitFor(
			client,
			htmlIs("recipe", (h) => h.includes("Back")),
		);
	}, 20_000);

	it("lays the run sheet on the session's serving time, and back in days without", async () => {
		client = new Client();
		await client.start({ views: true });
		client.open(TART("Tart"));
		client.notify("gram/setOpenViews", { uri: URI, viewIds: ["runSheet"] });
		await waitFor(
			client,
			htmlIs("runSheet", (h) => h.includes("D-2")),
		);

		client.notify("gram/setSession", { uri: URI, serveAt: "2026-10-11 13:00" });
		await waitFor(
			client,
			htmlIs("runSheet", (h) => !h.includes("D-2")),
		);

		client.notes.length = 0;
		client.notify("gram/setSession", { uri: URI });
		await waitFor(
			client,
			htmlIs("runSheet", (h) => h.includes("D-2")),
		);
	}, 20_000);

	it("lays the open views out again when the project's config changes, with no edit", async () => {
		const dir = await mkdtemp(join(tmpdir(), "gram-config-change-"));
		try {
			await mkdir(join(dir, ".gram"), { recursive: true });
			const config = join(dir, ".gram", "config.yaml");
			await writeFile(config, "availability: 00:00-24:00\n");
			const uri = pathToFileURL(join(dir, "tart.gram")).href;
			await writeFile(join(dir, "tart.gram"), TART("Tart"));
			client = new Client();
			await client.start({ views: true });
			client.open(TART("Tart"), uri);
			client.notify("gram/setOpenViews", { uri, viewIds: ["runSheet"] });
			client.notify("gram/setSession", { uri, serveAt: "2026-10-11 13:00" });
			await waitFor(
				client,
				(u) =>
					u.uri === uri && htmlIs("runSheet", (h) => !h.includes("D-2"))(u),
			);
			// Let the refreshes of the opening finish: one landing after the
			// config change would read it too, and hide a missing refresh.
			await quiet(client);
			const before = updatesOf(client).at(-1)!;

			// Never available: the same plan can no longer be followed. Renders of
			// the old plan may still arrive; only the config change can bring a
			// different one.
			await writeFile(config, "availability: none\n");
			const seen = new Set(updatesOf(client));
			client.notify("workspace/didChangeWatchedFiles", {
				changes: [{ uri: pathToFileURL(config).href, type: 2 }],
			});
			await waitFor(
				client,
				(u) =>
					!seen.has(u) &&
					u.uri === uri &&
					u.outputId === "runSheet" &&
					u.state === "ok" &&
					u.payload !== before.payload,
			);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	}, 20_000);

	it("lists the session's choices from the source as written: ingredients, imports, baker's math", async () => {
		const dir = await mkdtemp(join(tmpdir(), "gram-session-"));
		try {
			await writeFile(
				join(dir, "pastry.gram"),
				"---\ntitle: Pastry\n---\n\n## Pastry\n\nMix @butter{100g} with @flour{200g}.\n",
			);
			const uri = pathToFileURL(join(dir, "tart.gram")).href;
			const source = `@use "./pastry.gram" as &pastry\n\n## Assembly\n\nCombine &pastry{} with @flour{200g}(sifted).\n`;
			await writeFile(join(dir, "tart.gram"), source);
			client = new Client();
			await client.start({ views: true });
			client.open(source, uri);
			client.notify("gram/setOpenViews", { uri, viewIds: ["recipe"] });
			await waitFor(client, (u) => u.uri === uri && u.outputId === "recipe");
			type Choices = {
				ingredients: { id: string; qty?: number; unit?: string }[];
				imports: { uri: string; specifier: string }[];
				bakersMath: boolean;
				scaleError?: string;
			};
			const choices = (await client.request("gram/sessionChoices", {
				uri,
			})) as Choices;
			// The imported pastry's ingredients are there too: one shopping list.
			expect(choices.ingredients.map((i) => i.id).sort()).toEqual([
				"butter",
				"flour",
			]);
			expect(choices.ingredients.find((i) => i.id === "butter")).toEqual(
				expect.objectContaining({ qty: 100, unit: "g" }),
			);
			expect(choices.imports).toEqual([
				{
					uri: pathToFileURL(join(dir, "pastry.gram")).href,
					specifier: "./pastry.gram",
				},
			]);
			expect(choices.bakersMath).toBe(DEFAULT_RECIPE_SETTINGS.bakersMath);
			expect(choices.scaleError).toBeUndefined();

			// A target the recipe does not have: said, and the choices stay as written.
			client.notify("gram/setSession", {
				uri,
				scale: { type: "target", id: "saffron", qty: 1, unit: "g" },
			});
			await client.settle();
			const after = (await client.request("gram/sessionChoices", {
				uri,
			})) as Choices;
			expect(after.scaleError).toBeString();
			expect(after.ingredients).toEqual(choices.ingredients);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	}, 20_000);

	it("compiles the views at the session's scale, the editor on the source", async () => {
		client = new Client();
		await client.start({ views: true });
		client.open(TART("Tart"));
		client.notify("gram/setOpenViews", { uri: URI, viewIds: ["json"] });
		const flourOf = (u: Update) =>
			(
				JSON.parse((u.payload as { text: string }).text) as {
					shopping_list: { id: string; qty: number }[];
				}
			).shopping_list.find((i) => i.id === "flour")?.qty;
		await waitFor(client, (u) => u.outputId === "json" && flourOf(u) === 200);

		client.notify("gram/setSession", {
			uri: URI,
			scale: { type: "factor", value: 2 },
		});
		await waitFor(client, (u) => u.outputId === "json" && flourOf(u) === 400);

		// Closing forgets the session: reopened, the recipe is at its written size.
		client.notify("textDocument/didClose", { textDocument: { uri: URI } });
		client.notes.length = 0;
		client.open(TART("Tart"));
		client.notify("gram/setOpenViews", { uri: URI, viewIds: ["json"] });
		await waitFor(client, (u) => u.outputId === "json" && flourOf(u) === 200);
	}, 20_000);

	it("switches an undeclared client to the protocol on its first gram/setOpenViews", async () => {
		client = new Client();
		await client.start();
		client.open(TART("Tart"));
		await client.previewMatching((h) => h.includes("Tart"));

		client.notify("gram/setOpenViews", { uri: URI, viewIds: ["recipe"] });
		await waitFor(
			client,
			htmlIs("recipe", (h) => h.includes("Tart")),
		);
		client.notes.length = 0;
		client.change(TART("Pie"), 2);
		await waitFor(
			client,
			htmlIs("recipe", (h) => h.includes("Pie")),
		);
		expect(client.previews()).toEqual([]);
	}, 20_000);
});

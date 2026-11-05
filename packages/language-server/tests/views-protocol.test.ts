import { afterEach, describe, expect, it } from "bun:test";
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
		expect(listed.map((o) => o.id)).toEqual([
			"recipe",
			"workPlan",
			"ast",
			"json",
			"json-tree",
		]);
		expect(listed[1]?.label).toBe("Work plan");
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
		client.notify("gram/setOpenViews", { uri: URI, viewIds: ["workPlan"] });
		await waitFor(
			client,
			htmlIs("workPlan", (h) => h.includes("Work plan — Tart")),
		);

		client.change(TART("Pie"), 2);
		await waitFor(
			client,
			htmlIs("workPlan", (h) => h.includes("Work plan — Pie")),
		);
		await client.settle();
		expect(new Set(updatesOf(client).map((u) => u.outputId))).toEqual(
			new Set(["workPlan"]),
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

	it("lays the work plan on the session's serving time, and back in days without", async () => {
		client = new Client();
		await client.start({ views: true });
		client.open(TART("Tart"));
		client.notify("gram/setOpenViews", { uri: URI, viewIds: ["workPlan"] });
		await waitFor(
			client,
			htmlIs("workPlan", (h) => h.includes("D-2")),
		);

		client.notify("gram/setSession", { uri: URI, serveAt: "2026-10-11 13:00" });
		await waitFor(
			client,
			htmlIs("workPlan", (h) => !h.includes("D-2")),
		);

		client.notes.length = 0;
		client.notify("gram/setSession", { uri: URI });
		await waitFor(
			client,
			htmlIs("workPlan", (h) => h.includes("D-2")),
		);
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

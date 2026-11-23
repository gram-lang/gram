import { afterEach, describe, expect, it } from "bun:test";
import { Client, URI } from "./helpers/lsp-client";

/*
 * The three ways a client can want the views, end to end: `views: false` (an
 * editor with no panel), nothing said (an older client, until 2.0) and the
 * views protocol it can switch to at any time with `gram/setOpenViews`.
 */

const RECIPE = (title: string) => `---
title: ${title}
---

## Dough

Mix @flour{200g} with @water{120g}.
`;

const gramNotes = (client: Client) =>
	client.notes.filter((n) => n.method.startsWith("gram/"));

const deprecationWarnings = (client: Client) =>
	client.notes.filter(
		(n) =>
			n.method === "window/logMessage" &&
			String(n.params.message).includes("deprecated"),
	);

let client: Client | undefined;
afterEach(() => client?.stop());

describe("the views modes", () => {
	it("sends nothing on gram/* to a client that wants no views, nor the deprecation warning", async () => {
		client = new Client();
		await client.start({ views: false });
		client.open(RECIPE("Bread"));
		await client.diagnosticsOf(URI);
		client.change(RECIPE("Loaf"), 2);
		await client.settle();
		expect(gramNotes(client)).toEqual([]);
		expect(deprecationWarnings(client)).toEqual([]);
	}, 20_000);

	// The deprecated contract (lsp-legacy-view-notifications), until 2.0.0.
	it("keeps sending the preview to a client that said nothing, with the deprecation warning", async () => {
		client = new Client();
		await client.start();
		client.open(RECIPE("Bread"));
		await client.previewMatching((h) => h.includes("Bread"));
		expect(deprecationWarnings(client)).toHaveLength(1);
	}, 20_000);

	it("switches a client that wanted no views to the protocol on its first gram/setOpenViews", async () => {
		client = new Client();
		await client.start({ views: false });
		client.open(RECIPE("Bread"));
		await client.diagnosticsOf(URI);
		client.openViews(["recipe"]);
		await client.viewHtml("recipe", (h) => h.includes("Bread"));
		client.change(RECIPE("Loaf"), 2);
		await client.viewHtml("recipe", (h) => h.includes("Loaf"));
		expect(client.previews()).toEqual([]);
	}, 20_000);
});

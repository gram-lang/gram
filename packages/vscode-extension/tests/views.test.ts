import { describe, expect, it } from "bun:test";
import { contentOf, readViewsCapability } from "../src/views/protocol";
import { ViewsState } from "../src/views/state";
import { webviewPage } from "../src/views/webview";
import { createClientOptions } from "../src/client-options";

const A = "file:///a.gram";
const B = "file:///b.gram";
const PAUSED = {
	title: "Generation paused",
	description: "The recipe contains blocking errors.",
	code: "PARSE_ERROR",
	message: "Expected a name",
	range: { start: 3, end: 3 },
};

function recorder() {
	const sent: [string, string[]][] = [];
	return { sent, state: new ViewsState((uri, ids) => sent.push([uri, ids])) };
}

describe("ViewsState: what is open", () => {
	it("sends the open set of the followed recipe, once", () => {
		const { sent, state } = recorder();
		state.syncOpen(A, ["workPlan", "recipe"]);
		state.syncOpen(A, ["recipe", "workPlan"]);
		expect(sent).toEqual([[A, ["recipe", "workPlan"]]]);
	});

	it("closes everything on the old recipe when the panels follow another", () => {
		const { sent, state } = recorder();
		state.syncOpen(A, ["recipe"]);
		state.syncOpen(B, ["recipe"]);
		expect(sent).toEqual([
			[A, ["recipe"]],
			[A, []],
			[B, ["recipe"]],
		]);
	});

	it("says so when the last panel closes", () => {
		const { sent, state } = recorder();
		state.syncOpen(A, ["recipe"]);
		state.syncOpen(A, []);
		state.syncOpen(A, []);
		expect(sent).toEqual([
			[A, ["recipe"]],
			[A, []],
		]);
	});

	it("sends the set again for a recipe closed and reopened", () => {
		const { sent, state } = recorder();
		state.syncOpen(A, ["recipe"]);
		state.forget(A);
		state.syncOpen(A, ["recipe"]);
		expect(sent).toEqual([
			[A, ["recipe"]],
			[A, ["recipe"]],
		]);
	});
});

describe("ViewsState: what a panel shows", () => {
	it("keeps the last content under a pause, and drops the pause on the next content", () => {
		const { state } = recorder();
		state.apply({
			uri: A,
			outputId: "recipe",
			kind: "renderer",
			state: "ok",
			payload: "<h1>Tart</h1>",
		});
		const paused = state.apply({
			uri: A,
			outputId: "recipe",
			kind: "renderer",
			state: "paused",
			error: PAUSED,
		});
		expect(paused).toEqual({
			content: { type: "html", html: "<h1>Tart</h1>" },
			paused: PAUSED,
		});
		const back = state.apply({
			uri: A,
			outputId: "recipe",
			kind: "renderer",
			state: "ok",
			payload: "<h1>Pie</h1>",
		});
		expect(back).toEqual({
			content: { type: "html", html: "<h1>Pie</h1>" },
			paused: undefined,
		});
	});

	it("shows a pause alone for an output that never had content", () => {
		const { state } = recorder();
		const view = state.apply({
			uri: A,
			outputId: "ast",
			kind: "inspector",
			state: "paused",
			error: PAUSED,
		});
		expect(view).toEqual({ content: undefined, paused: PAUSED });
	});

	it("keeps each recipe's content apart, and forgets a closed one", () => {
		const { state } = recorder();
		state.apply({
			uri: A,
			outputId: "recipe",
			kind: "renderer",
			state: "ok",
			payload: "<h1>A</h1>",
		});
		expect(state.viewOf(B, "recipe").content).toBeUndefined();
		state.forget(A);
		expect(state.viewOf(A, "recipe").content).toBeUndefined();
	});
});

describe("contentOf", () => {
	it("reads every payload the server sends", () => {
		expect(contentOf(null)).toEqual({ type: "empty" });
		expect(contentOf("<p>x</p>")).toEqual({ type: "html", html: "<p>x</p>" });
		expect(
			contentOf({ presentation: "code", language: "json", text: "{}" }),
		).toEqual({ type: "code", language: "json", text: "{}" });
		expect(
			contentOf({ presentation: "tree", text: '<div class="gram-json-tree">' }),
		).toEqual({ type: "tree", html: '<div class="gram-json-tree">' });
	});
});

describe("readViewsCapability", () => {
	it("reads the outputs of the initialize result", () => {
		const gramViews = {
			outputs: [{ id: "recipe", kind: "renderer", label: "Recipe" }],
			strings: { showError: "Show the error", outputEmpty: "Nothing." },
		};
		expect(
			readViewsCapability({ capabilities: { experimental: { gramViews } } }),
		).toEqual(gramViews);
	});

	it("is undefined from a server without the views protocol", () => {
		expect(readViewsCapability({ capabilities: {} })).toBeUndefined();
		expect(readViewsCapability(undefined)).toBeUndefined();
	});
});

describe("the page of a view panel", () => {
	const page = webviewPage({
		nonce: "abc123",
		cspSource: "vscode-resource:",
		styles: { preview: "media/preview.css", jsonTree: "media/json-tree.css" },
		title: 'Plan "de" <travail>',
		showError: "Voir l'erreur",
		outputEmpty: "Rien </script><script>alert(1)</script>",
	});

	it("only runs its own script", () => {
		expect(page).toContain("script-src 'nonce-abc123'");
		expect(page.match(/<script/g)).toHaveLength(1);
		expect(page).toContain('<script nonce="abc123">');
	});

	it("escapes what it is given", () => {
		expect(page).toContain(
			"<title>Plan &quot;de&quot; &lt;travail&gt;</title>",
		);
		expect(page).not.toContain("alert(1)</script>");
	});

	it("loads both stylesheets and tells the extension when it is ready", () => {
		expect(page).toContain('href="media/preview.css"');
		expect(page).toContain('href="media/json-tree.css"');
		expect(page).toContain("postMessage({ type: 'ready' })");
	});
});

describe("the language client", () => {
	it("declares the views protocol", () => {
		expect(createClientOptions().initializationOptions).toEqual({
			views: true,
		});
	});
});

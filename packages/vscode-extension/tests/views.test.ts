import { describe, expect, it } from "bun:test";
import {
	contentOf,
	isPlanned,
	readServeAt,
	readSessionPatch,
	readViewsCapability,
} from "../src/views/protocol";
import { ViewsState } from "../src/views/state";
import { webviewPage } from "../src/views/webview";
import { fill, percentOf, sessionSummary } from "../src/webview/format";
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
		state.syncOpen(A, ["runSheet", "recipe"]);
		state.syncOpen(A, ["recipe", "runSheet"]);
		expect(sent).toEqual([[A, ["recipe", "runSheet"]]]);
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
		styles: {
			preview: "media/preview.css",
			jsonTree: "media/json-tree.css",
			view: "dist/webview/view.css",
		},
		script: "dist/webview/view.js",
		title: 'Plan "de" <travail>',
		showError: "Voir l'erreur",
		outputEmpty: "Rien </script><script>alert(1)</script>",
	});

	it("only runs its own script, from its own file", () => {
		expect(page).toContain("script-src 'nonce-abc123'");
		expect(page.match(/<script/g)).toHaveLength(1);
		expect(page).toContain(
			'<script nonce="abc123" src="dist/webview/view.js"></script>',
		);
	});

	it("escapes what it is given", () => {
		expect(page).toContain(
			"<title>Plan &quot;de&quot; &lt;travail&gt;</title>",
		);
		expect(page).not.toContain("alert(1)</script>");
	});

	it("loads the renderer's stylesheets and its own", () => {
		expect(page).toContain('href="media/preview.css"');
		expect(page).toContain('href="media/json-tree.css"');
		expect(page).toContain('href="dist/webview/view.css"');
		expect(page).not.toContain("<style");
	});
});

describe("the serving time of a view laid out in time", () => {
	const SERVING = {
		label: "Service le",
		clear: "Effacer",
		clearTitle: "Revenir <au> plan de marche",
		suggest: "Quand servir ?",
		none: "Rien",
		whyNot: "Pourquoi pas les autres ?",
		earliest: "Au plus tôt : {when}",
	};
	const base = {
		nonce: "abc123",
		cspSource: "vscode-resource:",
		styles: { preview: "p.css", jsonTree: "j.css", view: "v.css" },
		script: "v.js",
		title: "Plan",
		showError: "Voir",
		outputEmpty: "Rien",
	};

	it("is offered by the views that read the run sheet, whatever their id", () => {
		expect(
			isPlanned({ id: "x", kind: "renderer", label: "X", needs: ["runSheet"] }),
		).toBe(true);
		expect(
			isPlanned({ id: "runSheet", kind: "renderer", label: "W", needs: [] }),
		).toBe(false);
		expect(isPlanned({ id: "json", kind: "inspector", label: "J" })).toBe(
			false,
		);
	});

	it("puts the field and the suggestions on the page only when asked", () => {
		const page = webviewPage({ ...base, serving: SERVING });
		expect(page).toContain('type="datetime-local"');
		expect(page).toContain("Quand servir ?");
		expect(page).toContain('title="Revenir &lt;au&gt; plan de marche"');
		expect(webviewPage(base)).not.toContain('id="serving"');
	});

	it("reads only a serving time the server can read", () => {
		expect(readServeAt("2026-10-11T13:00")).toBe("2026-10-11T13:00");
		expect(readServeAt("")).toBeUndefined();
		expect(readServeAt(null)).toBeUndefined();
		expect(readServeAt("2026-10-11 13:00<x>")).toBeUndefined();
	});

	it("keeps it per recipe for the sitting, sends the whole session, and forgets it on close", () => {
		const { state } = recorder();
		expect(state.updateSession(A, { serveAt: "2026-10-11T13:00" })).toEqual({
			serveAt: "2026-10-11T13:00",
		});
		expect(
			state.updateSession(A, { serveAt: "2026-10-11T13:00" }),
		).toBeUndefined();
		expect(state.sessionOf(B)).toEqual({});
		expect(state.updateSession(A, { serveAt: null })).toEqual({});
		state.updateSession(A, { serveAt: "2026-10-12T20:00" });
		state.forget(A);
		expect(state.sessionOf(A)).toEqual({});
	});
});

describe("the session of a recipe: scale, stock, baker's reference", () => {
	const SESSION = {
		title: "Échelle et stock",
		scale: "Échelle",
		byIngredient: "ou par ingrédient",
		ingredient: "Choisir",
		qty: "Quantité",
		unit: "Unité",
		apply: "Appliquer",
		bakersReference: "Référence",
		auto: "Auto <@*>",
		stock: "En stock",
		stockHint: "Déjà prêt",
		reset: "Réinitialiser",
		scaled: "{factor} %",
		inStock: "{n} en stock",
		scaleError: "Échelle non appliquée : {reason}",
	};
	const base = {
		nonce: "abc123",
		cspSource: "vscode-resource:",
		styles: { preview: "p.css", jsonTree: "j.css", view: "v.css" },
		script: "v.js",
		title: "Recette",
		showError: "Voir",
		outputEmpty: "Rien",
	};

	it("adds each part to the session, keeps the others, and clears one with null", () => {
		const { state } = recorder();
		state.updateSession(A, { serveAt: "2026-10-11T13:00" });
		expect(
			state.updateSession(A, { scale: { type: "factor", value: 2 } }),
		).toEqual({
			serveAt: "2026-10-11T13:00",
			scale: { type: "factor", value: 2 },
		});
		expect(state.updateSession(A, { stock: ["file:///p.gram"] })).toEqual({
			serveAt: "2026-10-11T13:00",
			scale: { type: "factor", value: 2 },
			stock: ["file:///p.gram"],
		});
		expect(
			state.updateSession(A, {
				scale: null,
				stock: null,
				bakersReference: null,
			}),
		).toEqual({ serveAt: "2026-10-11T13:00" });
		expect(state.updateSession(A, { bakersReference: null })).toBeUndefined();
	});

	it("reads only the parts of a page message it understands", () => {
		expect(readSessionPatch({ scale: { type: "factor", value: 1.5 } })).toEqual(
			{ scale: { type: "factor", value: 1.5 } },
		);
		// 100 % is no scale; a factor that is not positive is ignored.
		expect(readSessionPatch({ scale: { type: "factor", value: 1 } })).toEqual({
			scale: null,
		});
		expect(readSessionPatch({ scale: { type: "factor", value: -2 } })).toEqual(
			{},
		);
		expect(
			readSessionPatch({
				scale: { type: "target", id: "flour", qty: 300, unit: " g " },
			}),
		).toEqual({ scale: { type: "target", id: "flour", qty: 300, unit: "g" } });
		expect(
			readSessionPatch({
				scale: { type: "target", id: "flour", qty: 300, unit: "" },
			}),
		).toEqual({ scale: { type: "target", id: "flour", qty: 300, unit: null } });
		expect(
			readSessionPatch({
				stock: ["file:///b.gram", "file:///a.gram", "file:///a.gram", 3],
			}),
		).toEqual({ stock: ["file:///a.gram", "file:///b.gram"] });
		expect(readSessionPatch({ stock: [] })).toEqual({ stock: null });
		expect(readSessionPatch({ bakersReference: "" })).toEqual({
			bakersReference: null,
		});
		expect(readSessionPatch({ serveAt: "tomorrow" })).toEqual({});
		expect(readSessionPatch({ serveAt: null, other: 1 })).toEqual({
			serveAt: null,
		});
		expect(readSessionPatch("nonsense")).toEqual({});
	});

	it("puts the controls on the page only when asked, escaped", () => {
		const page = webviewPage({ ...base, session: SESSION });
		expect(page).toContain('id="session"');
		expect(page).toContain('id="scale-factor"');
		expect(page).toContain("Auto &lt;@*&gt;");
		expect(webviewPage(base)).not.toContain('id="session"');
	});

	it("says in a few words what is active", () => {
		expect(sessionSummary({}, null, SESSION)).toBe("");
		expect(
			sessionSummary(
				{ scale: { type: "factor", value: 1.5 }, stock: ["file:///p.gram"] },
				null,
				SESSION,
			),
		).toBe("· 150 % · 1 en stock");
		const choices = {
			ingredients: [{ id: "flour", name: "farine" }],
			imports: [],
			bakersMath: true,
		};
		expect(
			sessionSummary(
				{
					scale: { type: "target", id: "flour", qty: 300, unit: "g" },
					bakersReference: "flour",
				},
				choices,
				SESSION,
			),
		).toBe("· 300 g farine · Référence : flour");
	});

	it("fills the words of the page, leaving an unknown name as it is", () => {
		expect(fill("Au plus tôt : {when}", { when: "sam. 20:00" })).toBe(
			"Au plus tôt : sam. 20:00",
		);
		expect(fill("{n} en stock {other}", { n: "2" })).toBe("2 en stock {other}");
		expect(percentOf(1.255)).toBe("125.5");
	});
});

describe("the language client", () => {
	it("declares the views protocol", () => {
		expect(createClientOptions().initializationOptions).toEqual({
			views: true,
		});
	});
});

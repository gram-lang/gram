import { describe, expect, it } from "bun:test";
import { DEFAULT_VIEW_SETTINGS } from "@gram-lang/renderer";
import { parseDocument } from "../src/document-state";
import {
	blockingDiagnostics,
	renderOutputs,
	type ViewUpdate,
} from "../src/views";

const URI = "file:///tmp/gram-views/a.gram";
const KITCHEN = {
	timeZone: "Europe/Paris",
	availability: { daily: [{ start: "00:00", end: "24:00" }] },
	now: "2026-10-01T08:00:00Z",
};
const OPTIONS = { settings: DEFAULT_VIEW_SETTINGS, kitchen: KITCHEN };

const TART = `---
title: Tart
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

const byId = (updates: ViewUpdate[]) =>
	Object.fromEntries(updates.map((u) => [u.outputId, u]));
const payloadOf = (update: ViewUpdate | undefined) =>
	update?.state === "ok" ? update.payload : undefined;

describe("renderOutputs", () => {
	it("renders only the outputs asked for, and skips an unknown one", () => {
		const updates = renderOutputs(
			URI,
			parseDocument(TART),
			["workPlan", "nope"],
			OPTIONS,
		);
		expect(updates.map((u) => u.outputId)).toEqual(["workPlan"]);
		expect(updates[0]).toMatchObject({
			uri: URI,
			kind: "renderer",
			state: "ok",
		});
		expect(payloadOf(updates[0])).toContain("Work plan — Tart");
	});

	it("renders nothing when nothing is open", () => {
		expect(renderOutputs(URI, parseDocument(TART), [], OPTIONS)).toEqual([]);
	});

	it("writes the recipe as the preview did, with the nutrition toggle", () => {
		const [recipe] = renderOutputs(
			URI,
			parseDocument(TART),
			["recipe"],
			OPTIONS,
		);
		const html = payloadOf(recipe);
		expect(typeof html).toBe("string");
		expect(html as string).toContain("Tart");
	});

	it("sends an inspector as text for its pane", () => {
		const out = byId(
			renderOutputs(
				URI,
				parseDocument(TART),
				["ast", "json", "json-tree"],
				OPTIONS,
			),
		);
		expect(out.ast).toMatchObject({ kind: "inspector", state: "ok" });
		expect(payloadOf(out.ast)).toMatchObject({
			presentation: "code",
			language: "scheme",
		});
		const json = payloadOf(out.json) as { text: string; language: string };
		expect(json.language).toBe("json");
		expect(JSON.parse(json.text).title).toBe("Tart");
		const tree = payloadOf(out["json-tree"]) as {
			presentation: string;
			text: string;
		};
		expect(tree.presentation).toBe("tree");
		expect(tree.text).toContain("<details");
	});

	it("lays the work plan on a serving time when the session has one", () => {
		const [days] = renderOutputs(
			URI,
			parseDocument(TART),
			["workPlan"],
			OPTIONS,
		);
		const [served] = renderOutputs(URI, parseDocument(TART), ["workPlan"], {
			...OPTIONS,
			serveAt: "2026-10-11T13:00",
		});
		expect(payloadOf(days)).toContain("D-2");
		expect(payloadOf(served)).not.toContain("D-2");
	});

	it("pauses every output on a parse error, with the error to show", () => {
		const updates = renderOutputs(
			URI,
			parseDocument(BROKEN),
			["recipe", "workPlan", "ast", "json"],
			{ ...OPTIONS, locale: "fr" },
		);
		expect(updates.map((u) => u.state)).toEqual([
			"paused",
			"paused",
			"paused",
			"paused",
		]);
		const first = updates[0];
		if (first?.state !== "paused") throw new Error("expected paused");
		expect(first.error.code).toBe("PARSE_ERROR");
		expect(first.error.message.length).toBeGreaterThan(0);
		expect(first.error.range).toBeDefined();
		expect(first).not.toHaveProperty("payload");
		expect(first.error).not.toHaveProperty("diagnostic");

		// In the editor's language, not the recipe's: there is no recipe.
		const [english] = renderOutputs(URI, parseDocument(BROKEN), ["recipe"], {
			...OPTIONS,
			locale: "en",
		});
		if (english?.state !== "paused") throw new Error("expected paused");
		expect(first.error.title).not.toBe(english.error.title);
	});

	it("keeps the AST inspector on a compile error: the AST is there", () => {
		const state = {
			...parseDocument(TART),
			compilation: null,
			compileError: "boom",
		};
		const out = byId(renderOutputs(URI, state, ["recipe", "ast"], OPTIONS));
		expect(out.recipe).toMatchObject({ state: "paused" });
		expect(out.ast).toMatchObject({ state: "ok" });
	});

	it("leaves out an output that throws, and still sends the others", () => {
		const state = parseDocument(TART);
		const errors: string[] = [];
		const updates = renderOutputs(
			URI,
			// A recipe the views cannot read, the AST still fine.
			{
				...state,
				compilation: {
					get meta(): never {
						throw new Error("unreadable");
					},
				} as never,
			},
			["recipe", "ast"],
			{ ...OPTIONS, onError: (id) => errors.push(id) },
		);
		expect(errors).toContain("recipe");
		expect(updates.map((u) => u.outputId)).toEqual(["ast"]);
	});
});

describe("blockingDiagnostics", () => {
	it("is empty for a recipe that compiles", () => {
		expect(blockingDiagnostics(parseDocument(TART))).toEqual([]);
	});

	it("is one blocking error for a parse or a compile failure", () => {
		expect(blockingDiagnostics(parseDocument(BROKEN))).toMatchObject([
			{ code: "PARSE_ERROR", severity: "error", blocking: true },
		]);
		expect(
			blockingDiagnostics({ ...parseDocument(TART), compileError: "boom" }),
		).toMatchObject([
			{ code: "COMPILE_ERROR", message: "boom", blocking: true },
		]);
	});
});

describe("parseDocument with a session", () => {
	const BREAD = `---
title: Bread
---

Mix @flour{200g} and @water{140g}.
`;
	const flourOf = (state: ReturnType<typeof parseDocument>) =>
		state.compilation?.shopping_list.find((i) => i.id === "flour")?.qty;

	it("scales by a factor", () => {
		const state = parseDocument(
			BREAD,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				scale: { type: "factor", value: 2 },
			},
		);
		expect(flourOf(state)).toBe(400);
		expect(state.scaleError).toBeNull();
	});

	it("scales to a target quantity of one ingredient", () => {
		const state = parseDocument(
			BREAD,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				scale: { type: "target", id: "water", qty: 70, unit: "g" },
			},
		);
		expect(flourOf(state)).toBe(100);
	});

	it("keeps the written size on a scale it cannot apply, without blocking", () => {
		const state = parseDocument(
			BREAD,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				scale: { type: "target", id: "sugar", qty: 3, unit: "g" },
			},
		);
		expect(flourOf(state)).toBe(200);
		expect(state.scaleError).toContain("sugar");
		expect(state.compileError).toBeNull();
	});

	it("is the source as written without one", () => {
		expect(flourOf(parseDocument(BREAD))).toBe(200);
	});
});

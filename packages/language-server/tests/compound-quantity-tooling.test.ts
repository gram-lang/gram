import { describe, it, expect } from "bun:test";
import type { CodeAction, TextEdit } from "vscode-languageserver";
import { parseDocument } from "../src/document-state";
import { provideCodeActions } from "../src/features/code-actions";
import { provideCompletions } from "../src/features/completions";
import { provideDiagnostics } from "../src/features/diagnostics";
import { weighAmount } from "@gram-lang/analyzer";
import { provideHover } from "../src/features/hover";
import type { IngredientDB } from "../src/ingredient-loader";
import { positionToOffset } from "../src/utils/position";

const URI = "file:///recipe.gram";
const recipe = (step: string) => `## Section\n\n${step}\n`;

/** The text once the first Quick Fix of `code` is applied. */
function fixed(text: string, code: string): { title: string; text: string } {
	const state = parseDocument(text);
	const diags = provideDiagnostics(state, URI).filter((d) => d.code === code);
	expect(diags).toHaveLength(1);
	const range = diags[0]!.range;
	const actions = provideCodeActions(state, range, diags, URI, {});
	const fix = actions.find((a: CodeAction) => a.kind === "quickfix");
	expect(fix).toBeDefined();
	const [edit] = fix!.edit!.changes![URI] as TextEdit[];
	const start = positionToOffset(state.lineStarts, edit!.range.start);
	const end = positionToOffset(state.lineStarts, edit!.range.end);
	return {
		title: fix!.title,
		text: text.slice(0, start) + edit!.newText + text.slice(end),
	};
}

/** The hover text over the first occurrence of `needle`. */
function hoverAt(text: string, needle: string, db: IngredientDB): string {
	const state = parseDocument(text);
	const before = text.slice(0, text.indexOf(needle) + 1).split("\n");
	const hover = provideHover(
		state,
		{ line: before.length - 1, character: before.at(-1)!.length },
		db,
	);
	return (hover?.contents as { value: string } | undefined)?.value ?? "";
}

describe("diagnostics of a sum", () => {
	it("carry the warning's data, for a Quick Fix to act on", () => {
		const state = parseDocument(recipe("Add @flour{100 g + 10%}."));
		const diag = provideDiagnostics(state, URI).find(
			(d) => d.code === "INVALID_QUANTITY",
		);
		expect(diag?.data).toEqual({ reason: "percentTerm", suggestion: "110 g" });
	});

	it("carry no data for a warning that has none", () => {
		const state = parseDocument(recipe("Bake ~{10}."));
		const diag = provideDiagnostics(state, URI).find(
			(d) => d.code === "MISSING_UNIT",
		);
		expect(diag).toBeDefined();
		expect(diag).not.toHaveProperty("data");
	});
});

describe("Quick Fixes of a sum", () => {
	it("adds two quantities written side by side with ' + '", () => {
		expect(fixed(recipe("Add @milk{1 cup 5 tbsp}."), "INVALID_UNIT").text).toBe(
			recipe("Add @milk{1 cup + 5 tbsp}."),
		);
	});

	it("adds them inside a term of a sum, leaving a name with the unit alone", () => {
		expect(
			fixed(recipe("Add @lb cake{1 lb 4 oz + 2 oz}."), "INVALID_UNIT").text,
		).toBe(recipe("Add @lb cake{1 lb + 4 oz + 2 oz}."));
	});

	it("writes the result of a percentage", () => {
		const fix = fixed(recipe("Add @=flour{100 g + 10%}."), "INVALID_QUANTITY");
		expect(fix.title).toBe("Replace with {110 g}");
		expect(fix.text).toBe(recipe("Add @=flour{110 g}."));
	});

	it("writes fl oz after a volume", () => {
		expect(
			fixed(recipe("Add @water{1 cup + 2 oz}."), "OZ_AFTER_VOLUME").text,
		).toBe(recipe("Add @water{1 cup + 2 fl oz}."));
	});

	it("offers nothing for a refused sum Gram cannot correct", () => {
		const text = recipe("Add @milk{1 + 1 cup}.");
		const state = parseDocument(text);
		const diags = provideDiagnostics(state, URI).filter(
			(d) => d.code === "INVALID_QUANTITY",
		);
		const actions = provideCodeActions(state, diags[0]!.range, diags, URI, {});
		expect(actions.filter((a) => a.kind === "quickfix")).toEqual([]);
	});
});

describe("hover on a sum", () => {
	const db: IngredientDB = {
		flour: { name: "Flour", physical: { density: 0.53 } },
	};

	it("shows what a sum of one family adds up to", () => {
		const text = recipe("Add @flour{1 cup + 1 tbsp}.");
		expect(hoverAt(text, "@flour", db)).toContain(
			"**Total**: 1 cup + 1 tbsp = **17 tbsp**",
		);
	});

	it("shows the mass of the sum, part by part", () => {
		const text = recipe("Add @flour{1 cup + 20 g}.");
		const hover = hoverAt(text, "@flour", db);
		expect(hover).toContain(
			"**1 cup** _(volume)_ + **20 g** _(weight)_, counted apart",
		);
		// 1 cup ≈ 236.59 ml × 0.53 ≈ 125.4 g, plus 20 g.
		expect(hover).toMatch(/1 cup \+ 20 g ≈ \*\*145 g\*\*/);
	});

	it("calls exact a sum of weights, and weighs what is taken away", () => {
		const text = recipe("Add @flour{1 kg - 200 g + 50 g}.");
		expect(hoverAt(text, "@flour", db)).toContain(
			"**Conversion**: 1 kg − 200 g + 50 g = **850 g**",
		);
	});

	it("tells the mass the views tell (weighAmount)", () => {
		const text = recipe("Add @flour{1 cup - 2 tbsp + 30 g}.");
		const weighed = weighAmount(
			[
				{ value: 1, unit: "cup" },
				{ value: 2, unit: "tbsp", minus: true },
				{ value: 30, unit: "g" },
			],
			db,
			"Flour",
		);
		expect(weighed?.isEstimate).toBe(true);
		expect(hoverAt(text, "@flour", db)).toContain(
			`≈ **${Math.round(weighed!.normalizedMass)} g** _(density: 0.53 g/ml)_`,
		);
	});

	it("shows what each kind comes to when a sum takes away within one kind", () => {
		const text = recipe("Add @butter{1 cup - 2 tbsp + 30 g}.");
		expect(hoverAt(text, "@butter", db)).toContain(
			"= **14 tbsp** _(volume)_ + **30 g** _(weight)_, counted apart: each kind adds up and takes away on its own",
		);
	});

	it("shows the total of an ingredient the database lacks", () => {
		const text = recipe("Add @sugar{1 cup - 2 tbsp}.");
		expect(hoverAt(text, "@sugar", db)).toContain("= **14 tbsp**");
	});

	it("says nothing of a sum Gram refuses", () => {
		const text = recipe("Add @sugar{1 + 1 cup}.");
		expect(hoverAt(text, "@sugar", db)).toBe("");
	});
});

describe("unit completions in a sum", () => {
	const state = parseDocument(recipe("Mix."));
	const labels = (prefix: string) =>
		provideCompletions(state, {}, prefix).map((c) => c.label);

	it("offers units once the next term has its number", () => {
		expect(labels("Mix @flour{1 cup + 2")).toContain("tbsp");
		expect(labels("Mix @flour{1 cup - 2")).toContain("tbsp");
		expect(labels("Mix @flour{1 cup + 1-2")).toContain("tbsp");
	});

	it("waits for the number of the next term", () => {
		expect(labels("Mix @flour{1 cup + ")).toEqual([]);
		expect(labels("Mix @flour{1 cup - ")).toEqual([]);
	});

	it("still reads a range as one term", () => {
		expect(labels("Mix @flour{1-2")).toContain("cup");
	});
});

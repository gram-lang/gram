import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { analyze, type IngredientData } from "@gram-lang/analyzer";
import { parseDocument } from "../src/document-state";
import { provideDiagnostics } from "../src/features/diagnostics";
import { provideNutritionHover } from "../src/features/hover-nutrition";
import type { IngredientDB } from "../src/ingredient-loader";

// One verdict for "unknown ingredient": the editor squiggles exactly the
// ingredients the nutrition does not find (`analyzed.missingIngredients`),
// and its nutrition hover shows up for exactly the ones it does. The editor
// used to keep a lookup of its own that disagreed both ways: a French plural
// guess accepted `@carottes` while nutrition skipped it (even `@pâtes`,
// pasta, passed as `pâte`, pastry), and a hyphen, a curly apostrophe or a
// database key not written as a slug were flagged although nutrition found
// them.

const entry = (name: string, aliases?: string[]): IngredientData =>
	({
		name,
		...(aliases ? { aliases } : {}),
		nutrition: { per100g: { kcal: 100 } },
	}) as unknown as IngredientData;

const DB: IngredientDB = {
	carotte: entry("Carotte"),
	"tomate-cerise": entry("Tomate cerise"),
	pate: entry("Pâte brisée"),
	egg: entry("Egg"),
	"huile-dolive": entry("Huile d'olive"),
	"creme-fraiche": entry("Crème fraîche"),
	"pak-choi": entry("Pak choï", ["bok choy"]),
	Butter: entry("Beurre doux"),
	oeuf: entry("Œuf"),
	olive_oil: entry("Olive oil"),
	"sel-fin": entry("Sel fin", ["sel de table"]),
};

const source = (name: string) =>
	`---\ntitle: T\n---\n\n## Steps\n\nAdd @${name}{100 g}.\n`;

function editorFlags(name: string): boolean {
	return provideDiagnostics(parseDocument(source(name), DB), "", DB).some(
		(d) => d.code === "UNKNOWN_INGREDIENT",
	);
}

function nutritionMisses(name: string): boolean {
	const analyzed = analyze(compile(getAST(source(name))), DB);
	return analyzed.missingIngredients.length > 0;
}

function hoverShows(name: string): boolean {
	const text = source(name);
	const state = parseDocument(text, DB);
	const line = text.split("\n").findIndex((l) => l.startsWith("Add @"));
	return provideNutritionHover(state, { line, character: 6 }, DB) !== null;
}

// Each now gets the verdict nutrition gives it.
const NOW_FLAGGED = [
	"carottes", // FR plural, the database knows only `carotte`
	"tomates cerises",
	"sels fins",
	"œufs",
	"pâtes", // pasta, not `pâte` (pastry)
	"eggs", // EN plural
];
const NO_LONGER_FLAGGED = [
	"Huile d’olive", // curly apostrophe
	"huile-d-olive",
	"olive-oil",
	"sel-de-table", // alias written with hyphens
	"Bok-Choy",
	"butter", // database key `Butter`, not written as a slug
];
const KNOWN_EVERYWHERE = [
	"carotte",
	"Egg",
	"huile d'olive",
	"Crème Fraîche",
	"creme fraiche",
	"pak choi",
	"Oeuf",
	"olive oil",
	"sel de table",
];

describe("UNKNOWN_INGREDIENT agrees with the nutrition", () => {
	it.each(NOW_FLAGGED)("flags @%s, which nutrition does not find", (name) => {
		expect(nutritionMisses(name)).toBe(true);
		expect(editorFlags(name)).toBe(true);
		expect(hoverShows(name)).toBe(false);
	});

	it.each(NO_LONGER_FLAGGED)("accepts @%s, which nutrition finds", (name) => {
		expect(nutritionMisses(name)).toBe(false);
		expect(editorFlags(name)).toBe(false);
		expect(hoverShows(name)).toBe(true);
	});

	it.each(KNOWN_EVERYWHERE)("accepts @%s (case, accents)", (name) => {
		expect(nutritionMisses(name)).toBe(false);
		expect(editorFlags(name)).toBe(false);
		expect(hoverShows(name)).toBe(true);
	});

	it("still suggests the closest entry for a plural it now flags", () => {
		const diag = provideDiagnostics(
			parseDocument(source("carottes"), DB),
			"",
			DB,
		).find((d) => d.code === "UNKNOWN_INGREDIENT");
		expect(diag?.data).toEqual({ name: "carottes", suggestion: "Carotte" });
		expect(diag?.message).toContain("Did you mean '@Carotte'?");
	});

	it("suggests through a database key not written as a slug", () => {
		const diag = provideDiagnostics(
			parseDocument(source("buter"), DB),
			"",
			DB,
		).find((d) => d.code === "UNKNOWN_INGREDIENT");
		expect(diag?.data).toEqual({ name: "buter", suggestion: "Beurre doux" });
	});

	it("says nothing without a database", () => {
		expect(
			provideDiagnostics(parseDocument(source("carottes"))).some(
				(d) => d.code === "UNKNOWN_INGREDIENT",
			),
		).toBe(false);
	});
});

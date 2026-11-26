import { describe, expect, it } from "bun:test";
import {
	isKnownIngredient,
	validateIngredientDatabase,
} from "@gram-lang/analyzer";
import type { LintFix } from "../../src/lint";
import { applyFix, entry, lintCode } from "./lint-helpers";

const parse = (text: string) => Bun.YAML.parse(text);
const DB_URI = "file:///project/.gram/ingredients.yaml";
const TITLE = "---\ntitle: T\n---\n\n";
const db = { flour: entry("Flour"), sugar: entry("Sugar") };

/** The ADD_TO_INGREDIENTS_DB fix of the first unknown ingredient of `recipe`. */
function addFix(recipe: string, dbText: string): LintFix | undefined {
	const [d] = lintCode("UNKNOWN_INGREDIENT", recipe, {
		ingredientDB: db,
		ingredientsFile: { uri: DB_URI, text: dbText },
	});
	return d!.fixes?.find((f) => f.edits.some((e) => e.uri === DB_URI));
}

/** The database once the fix is applied, as `loadIngredientDB` reads it. */
function loaded(text: string) {
	const parsed = parse(text) as { ingredients?: unknown };
	const { data, rejected } = validateIngredientDatabase(
		parsed?.ingredients ?? parsed,
	);
	expect(rejected).toEqual([]);
	return data;
}

const WRAPPED =
	'ingredients:\n  flour:\n    name: "Flour"\n  sugar:\n    name: "Sugar"\n';
const FLAT = "flour:\n  name: Flour\nsugar:\n  name: Sugar\n";

describe("ADD_TO_INGREDIENTS_DB", () => {
	it("adds a commented skeleton under the ingredients: wrapper, never as the preferred fix", () => {
		const fix = addFix(`${TITLE}Add @crème fraîche{20 cl}.\n`, WRAPPED)!;
		expect(fix.title).toBe("Add 'crème fraîche' to ingredients.yaml");
		expect(fix.isPreferred).toBeUndefined();
		expect(fix.edits).toHaveLength(1);
		const text = applyFix(WRAPPED, fix, DB_URI);
		expect(text).toContain('\n  creme-fraiche:\n    name: "crème fraîche"\n');
		expect(text).toContain("    # nutrition:          # per 100 g\n");
		expect(text).toContain("allergens");
		const data = loaded(text);
		expect(Object.keys(data)).toEqual(["flour", "sugar", "creme-fraiche"]);
		// The new entry resolves the ingredient: the diagnostic goes away.
		expect(isKnownIngredient("crème fraîche", data)).toBe(true);
		expect(
			lintCode("UNKNOWN_INGREDIENT", `${TITLE}Add @crème fraîche{20 cl}.\n`, {
				ingredientDB: data,
			}),
		).toEqual([]);
	});

	it("adds it at the top level of a database without the wrapper", () => {
		const text = applyFix(
			FLAT,
			addFix(`${TITLE}Add @salt{1 g}.\n`, FLAT)!,
			DB_URI,
		);
		expect(text).toEndWith(
			'salt:\n  name: "salt"\n  # aliases: []\n  # category: ""\n  # tags: []            # allergens and diets, e.g. ["gluten", "vegan"]\n  # physical:\n  #   density: 1.0      # g/mL\n  #   unit_weight: 100  # g per piece\n  # nutrition:          # per 100 g\n  #   calories: 0\n  #   protein: 0\n  #   carbs: 0\n  #   fat: 0\n',
		);
		expect(Object.keys(loaded(text))).toEqual(["flour", "sugar", "salt"]);
	});

	it("writes inside the wrapper when another key follows it", () => {
		const dbText = `${WRAPPED}version: 2\n`;
		const text = applyFix(
			dbText,
			addFix(`${TITLE}Add @salt{1 g}.\n`, dbText)!,
			DB_URI,
		);
		const parsed = parse(text) as { ingredients: object; version: number };
		expect(Object.keys(parsed.ingredients)).toEqual(["flour", "sugar", "salt"]);
		expect(parsed.version).toBe(2);
	});

	it("handles a file with no final line break, and keeps CRLF line breaks", () => {
		const noEol = "flour:\n  name: Flour";
		const t1 = applyFix(
			noEol,
			addFix(`${TITLE}Add @salt{1 g}.\n`, noEol)!,
			DB_URI,
		);
		expect(t1).toStartWith("flour:\n  name: Flour\n\nsalt:\n");
		expect(Object.keys(loaded(t1))).toEqual(["flour", "salt"]);

		const crlf = "ingredients:\r\n  flour:\r\n    name: Flour\r\n";
		const t2 = applyFix(
			crlf,
			addFix(`${TITLE}Add @salt{1 g}.\n`, crlf)!,
			DB_URI,
		);
		expect(t2.replace(/\r\n/g, "")).not.toContain("\n");
		expect(Object.keys(loaded(t2))).toEqual(["flour", "salt"]);
	});

	it("escapes the name, and quotes a key the slug cannot give", () => {
		const fix = addFix(`${TITLE}Add @piment d'Espelette "AOP"{1 g}.\n`, FLAT)!;
		const text = applyFix(FLAT, fix, DB_URI);
		expect(text).toContain('name: "piment d\'Espelette \\"AOP\\""');
		expect(loaded(text)["piment-d-espelette-aop"]?.name).toBe(
			'piment d\'Espelette "AOP"',
		);
	});

	it("offers nothing when the entry is already in the buffer, nor for an inline wrapper", () => {
		const recipe = `${TITLE}Add @salt{1 g}.\n`;
		expect(addFix(recipe, `${FLAT}salt:\n  name: Salt\n`)).toBeUndefined();
		expect(
			addFix(recipe, `ingredients:\n  "Salt":\n    name: Sel\n`),
		).toBeUndefined();
		expect(addFix(recipe, "ingredients: {}\n")).toBeUndefined();
	});

	it("is not offered without the database file", () => {
		const [d] = lintCode("UNKNOWN_INGREDIENT", `${TITLE}Add @salt{1 g}.\n`, {
			ingredientDB: db,
		});
		expect(d!.fixes?.some((f) => f.title.startsWith("Add '"))).not.toBe(true);
	});
});

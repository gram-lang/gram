import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyze, type IngredientData } from "@gram-lang/analyzer";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { DEFAULT_SOURCES } from "./db";
import { compiledTargetId, scaleRecipe } from "./scaling";

// The playground's own database and recipes: what the cook has in front of them.
const database: Record<string, IngredientData> = {};
for (const source of DEFAULT_SOURCES) {
	if (source.data) Object.assign(database, source.data);
}
const example = (file: string) =>
	readFileSync(
		join(import.meta.dir, "..", "..", "..", "public", "examples", file),
		"utf-8",
	);
const compiled = (source: string) =>
	compile(getAST(source), { scaleFactor: 1 });
const idsOf = (r: { shopping_list?: { id: string }[] }) =>
	(r.shopping_list ?? []).map((i) => i.id);

const request = (extra: Partial<Parameters<typeof scaleRecipe>[1]> = {}) => ({
	targetId: null,
	targetQty: null,
	targetUnit: "",
	factorString: "100",
	...extra,
});

describe("the ingredient the options list offers, found in the recipe", () => {
	it("is the one the options list names, when the recipe writes the same word", () => {
		const recipe = compiled(example("empanadas.gram"));
		expect(
			compiledTargetId("flour", recipe.shopping_list ?? [], database),
		).toBe("flour");
	});

	it("finds the recipe's own word behind the database key, as a French recipe writes it", () => {
		const recipe = compiled(example("empanadas-fr.gram"));
		// What the options list offers is the analyzed list: farine is flour.
		const offered = analyze(recipe, database, { lang: "fr" }).result
			.shopping_list as { id: string }[];
		expect(idsOf(recipe)).toContain("farine");
		expect(idsOf({ shopping_list: offered })).toContain("flour");
		expect(
			compiledTargetId("flour", recipe.shopping_list ?? [], database),
		).toBe("farine");
	});

	it("leaves an ingredient it does not know as it is", () => {
		const recipe = compiled(example("empanadas.gram"));
		expect(
			compiledTargetId("saffron", recipe.shopping_list ?? [], database),
		).toBe("saffron");
	});

	it("leaves the choice alone when several lines of the recipe are that ingredient", () => {
		const db: Record<string, IngredientData> = {
			flour: { name: "Flour", aliases: ["farine", "farina"] },
		};
		const recipe = compiled("## A\n\nMix @farine{200 g} and @farina{300 g}.\n");
		expect(compiledTargetId("flour", recipe.shopping_list ?? [], db)).toBe(
			"flour",
		);
	});
});

describe("scaling by an ingredient", () => {
	for (const [file, lang, word] of [
		["empanadas.gram", "en", "flour"],
		["empanadas-fr.gram", "fr", "farine"],
	] as const) {
		it(`scales the ${lang} recipe by its flour, whichever word the recipe writes (${word})`, () => {
			const recipe = compiled(example(file));
			const scaled = scaleRecipe(
				recipe,
				request({ targetId: "flour", targetQty: 550, targetUnit: "g" }),
				database,
				lang,
			);
			expect(scaled.error).toBeUndefined();
			expect(scaled.factorString).toBe("110");
			const flour = scaled.result.shopping_list?.find((i) => i.id === word);
			expect(flour?.qty).toBe(550);
			expect(scaled.result).not.toBe(recipe);
		});
	}

	it("says so when the ingredient is not in the recipe, leaving the recipe as it was", () => {
		const recipe = compiled(example("empanadas.gram"));
		const scaled = scaleRecipe(
			recipe,
			request({ targetId: "saffron", targetQty: 5, targetUnit: "g" }),
			database,
			"en",
		);
		expect(scaled.error).toContain('Ingredient "saffron" not found');
		expect(scaled.result).toBe(recipe);
		expect(scaled.factorString).toBeUndefined();
	});

	it("says so when the same ingredient is written in several ways, rather than scaling by a part of it", () => {
		const db: Record<string, IngredientData> = {
			flour: { name: "Flour", aliases: ["farine", "farina"] },
		};
		const recipe = compiled("## A\n\nMix @farine{200 g} and @farina{300 g}.\n");
		const scaled = scaleRecipe(
			recipe,
			request({ targetId: "flour", targetQty: 550, targetUnit: "g" }),
			db,
			"en",
		);
		expect(scaled.error).toContain('Ingredient "flour" not found');
		expect(scaled.result).toBe(recipe);
	});

	it("scales by a target even when a percentage is also set: the target wins", () => {
		const recipe = compiled(example("empanadas.gram"));
		const scaled = scaleRecipe(
			recipe,
			request({
				targetId: "flour",
				targetQty: 550,
				targetUnit: "g",
				factorString: "300",
			}),
			database,
			"en",
		);
		expect(scaled.factorString).toBe("110");
	});
});

describe("scaling the whole recipe by a percentage", () => {
	it("scales every quantity, and leaves the percentage field as the cook typed it", () => {
		const recipe = compiled(example("empanadas.gram"));
		const before = recipe.shopping_list?.find((i) => i.id === "flour")?.qty;
		const scaled = scaleRecipe(
			recipe,
			request({ factorString: "150" }),
			database,
			"en",
		);
		expect(scaled.error).toBeUndefined();
		expect(scaled.factorString).toBeUndefined();
		const after = scaled.result.shopping_list?.find(
			(i) => i.id === "flour",
		)?.qty;
		expect(after).toBe((before as number) * 1.5);
	});

	it("leaves the recipe alone at 100%, or at a percentage that is not one", () => {
		const recipe = compiled(example("empanadas.gram"));
		for (const factorString of ["100", "", "abc", "0", "-50"]) {
			const scaled = scaleRecipe(
				recipe,
				request({ factorString }),
				database,
				"en",
			);
			expect(scaled.result).toBe(recipe);
			expect(scaled.error).toBeUndefined();
		}
	});
});

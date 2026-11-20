import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { analyze } from "../src/index";
import { diffRecipes } from "../src/diff";
import { massOf, weighAmount } from "../src/mass_standardization";
import type { IngredientData } from "../src/types";

// The mass of a sum of quantities (`{1 cup + 20 g}`, `{1 cup - 2 tbsp}`):
// weighed family by family, as occurrences written apart would be.
const database = {
	flour: { name: "flour", physical: { density: 0.55 } },
	sugar: { name: "sugar", physical: { density: 0.85 } },
	salt: { name: "salt", physical: { density: 1.2 } },
	onion: { name: "onion", physical: { unit_weight: 100, yield: 0.9 } },
} as unknown as Record<string, IngredientData>;

const run = (body: string) =>
	analyze(compile(getAST(`## Dough\n\n${body}\n`)), database).result;

const ingredient = (result: ReturnType<typeof run>, id: string) =>
	result.sections[0]!.ingredients.find((i) => i.id === id)!;

const entries = (result: ReturnType<typeof run>, id: string) =>
	result.shopping_list.filter((i) => i.id === id) as Array<Record<string, any>>;

describe("massOf / weighAmount", () => {
	it("weighs each family of a sum and lists the terms it cannot weigh", () => {
		const terms = [
			{ value: 1, unit: "cup" },
			{ value: 20, unit: "g" },
		];
		const flour = massOf(terms, database, "flour");
		expect(flour.unknown).toEqual([]);
		expect(flour.known.map((k) => k.method)).toEqual(["density", "physical"]);

		const rice = massOf(terms, database, "rice");
		expect(rice.known.map((k) => k.mass)).toEqual([20]);
		expect(rice.unknown).toEqual([{ value: 1, unit: "cup" }]);
		// A partial mass would read as the whole: no mass at all.
		expect(weighAmount(terms, database, "rice")).toBeNull();
	});

	it("weighs a sum of one family as the total it amounts to", () => {
		const sum = weighAmount(
			[
				{ value: 1, unit: "cup" },
				{ value: 2, unit: "tbsp", minus: true },
			],
			database,
			"sugar",
		);
		const total = weighAmount([{ value: 14, unit: "tbsp" }], database, "sugar");
		expect(sum).toEqual(total);
	});

	it("applies the yield term by term: a unit weight is gross, a gram net", () => {
		const weighed = weighAmount(
			[
				{ value: 2, unit: "pieces" },
				{ value: 50, unit: "g" },
			],
			database,
			"onion",
			undefined,
			undefined,
			0.9,
		)!;
		// 2 × 100 g bought, 180 g used; 50 g used, 55.56 g bought.
		expect(weighed.normalizedMass).toBeCloseTo(230, 6);
		// applyYield rounds each derived mass to 2 decimals.
		expect(weighed.purchasingMass).toBeCloseTo(255.56, 6);
		expect(weighed.method).toBe("estimate");
		expect(weighed.isEstimate).toBe(true);
	});
});

describe("analyze() on a sum of quantities", () => {
	it("weighs a sum over two families when the density is known", () => {
		const result = run("Mix @flour{1 cup + 20 g}.");
		const flour = ingredient(result, "flour");
		expect(flour.normalizedMass).toBe(150.12);
		expect(flour.conversionMethod).toBe("estimate");
		expect(flour.isEstimate).toBe(true);
		// Bought as two entries, merged back by mass into one line.
		expect(entries(result, "flour")).toHaveLength(1);
		expect(entries(result, "flour")[0]!.normalizedMass).toBe(150.12);
	});

	it("gives a shopping entry the mass of its own terms only", () => {
		// `rice` has no density: the cup stays unweighed, the grams do not.
		const result = run("Mix @rice{1 cup + 20 g} with @rice{50 g}.");
		expect(ingredient(result, "rice").normalizedMass).toBeUndefined();
		const grams = entries(result, "rice").find((e) => e.unit === "g")!;
		// 20 g of the sum and 50 g on their own, not 50 g (or the sum twice).
		expect(grams.qty).toBe(70);
		expect(grams.normalizedMass).toBe(70);
		const cup = entries(result, "rice").find((e) => e.unit === "cup")!;
		expect(cup.normalizedMass).toBeUndefined();
	});

	it("does not count a sum split over two ladders twice", () => {
		// `cup` and `ml` are two ladders of one family: two shopping entries.
		const result = run("Add @sugar{1 cup + 50 ml}.");
		const sugar = ingredient(result, "sugar");
		const list = entries(result, "sugar");
		expect(list).toHaveLength(1);
		expect(list[0]!.normalizedMass).toBeCloseTo(sugar.normalizedMass!, 1);
	});

	it("keeps the bounds of a range when entries merge by mass", () => {
		const result = run("Add @salt{2-3 g} and @salt{1 tsp}.");
		const [salt] = entries(result, "salt");
		expect(salt!.unit).toBe("g");
		const mass = salt!.normalizedMass as number;
		expect(salt!.range.min).toBeCloseTo(mass - 0.5, 2);
		expect(salt!.range.max).toBeCloseTo(mass + 0.5, 2);
	});

	it("warns once about an unknown mass bought in two units", () => {
		const result = run("Add @garlic{1 head + 2 cloves}.");
		const garlic = result.warnings.filter(
			(w) => w.code === "UNKNOWN_MASS" && w.message.includes('"garlic"'),
		);
		expect(garlic).toHaveLength(1);
	});

	it("counts a refused sum for nothing, without a mass warning", () => {
		const result = run("Add @flour{100 g + 10%}.");
		expect(result.warnings.some((w) => w.code === "UNKNOWN_MASS")).toBe(false);
	});
});

describe("diffRecipes() on amounts", () => {
	const compiled = (body: string) =>
		compile(getAST(`## Dough\n\n${body}\n`)) as Parameters<
			typeof diffRecipes
		>[0];

	it("sees a range whose bounds change around the same middle", () => {
		const diff = diffRecipes(
			compiled("Add @salt{2-4 g}."),
			compiled("Add @salt{1-5 g}."),
		);
		expect(diff.ingredients).toEqual([
			expect.objectContaining({
				change: "changed",
				fromQty: 3,
				toQty: 3,
				fromText: "2-4 g",
				toText: "1-5 g",
			}),
		]);
	});

	it("writes a range added up by its bounds, not its middle", () => {
		const diff = diffRecipes(
			compiled("Add @salt{1 g}."),
			compiled("Add @salt{2-3 g} and @salt{200 g}."),
		);
		expect(diff.ingredients[0]).toMatchObject({
			fromText: "1 g",
			toText: "202-203 g",
		});
	});

	it("writes cups and spoons as the shopping list does, not as a total in spoons", () => {
		const diff = diffRecipes(
			compiled("Add @flour{1 cup + 1 tbsp} and @milk{1 cup + 1-2 tbsp}."),
			compiled("Add @flour{1 cup + 3 tbsp} and @milk{1 cup + 2-3 tbsp}."),
		);
		const byId = (id: string) => diff.ingredients.find((d) => d.id === id);
		expect(byId("flour")).toMatchObject({
			fromQty: 17,
			toQty: 19,
			fromText: "1 cup + 1 tbsp",
			toText: "1 cup + 3 tbsp",
		});
		expect(byId("milk")).toMatchObject({
			fromText: "1 cup + 1-2 tbsp",
			toText: "1 cup + 2-3 tbsp",
		});
	});
});

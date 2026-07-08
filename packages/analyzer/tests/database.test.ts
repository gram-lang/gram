import { describe, it, expect } from "bun:test";
import { validateIngredientDatabase } from "../src/index";
import { parse } from "yaml";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("YAML Database Validation", () => {
	it("should correctly validate the examples/ingredients.yaml file", () => {
		// Read the example file
		const filePath = join(import.meta.dir, "fixtures/ingredients.yaml");
		const fileContent = readFileSync(filePath, "utf-8");

		// Parse YAML
		const parsedYaml = parse(fileContent);

		// The file wraps ingredients in an "ingredients:" root key
		const rawDb = parsedYaml.ingredients;

		const { data, rejected } = validateIngredientDatabase(rawDb);

		expect(rejected).toEqual([]);
		expect(data.mustard).toBeDefined();
		expect(data.mustard.name).toBe("Moutarde de Dijon");
		expect(data.mustard.nutrition?.calories).toBe(151);

		expect(data.sugar).toBeDefined();
		expect(data.sugar.nutrition?.sugar).toBe(100);
	});

	it("loads every valid entry and reports rejected ones individually, instead of failing the whole database over a single bad entry", () => {
		const rawDb = {
			good: {
				name: "Good Ingredient",
				nutrition: { calories: 100, protein: 1, carbs: 1, fat: 1 },
			},
			bad: { name: "Bad Ingredient", physical: { density: -1 } },
		};

		const { data, rejected } = validateIngredientDatabase(rawDb);

		expect(data.good).toBeDefined();
		expect(data.bad).toBeUndefined();
		expect(rejected).toHaveLength(1);
		expect(rejected[0]?.key).toBe("bad");
	});
});

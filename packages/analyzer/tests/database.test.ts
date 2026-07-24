import { describe, it, expect } from "bun:test";
import { validateIngredientDatabase } from "../src/index";
import { parse } from "yaml";
import { readFileSync, readdirSync, existsSync } from "node:fs";
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

// Regression tests for the audit (2026-07-22, analyzer finding B1): the
// schema required `physical.density` even when only `unit_weight` was
// given, rejecting every "count -> mass" ingredient — including the
// analyzer's own README example. `gram db enrich` produces exactly this
// shape, so it closed a loop with `gram build`/`gram db validate` rejecting
// what enrich had just written. Closure per the plan: every example
// database in the repo must validate with zero rejections, not just the one
// site the audit happened to check.
describe("validateIngredientDatabase — every example database in the repo validates (finding B1)", () => {
	it("validates the analyzer README's own example (unit_weight-only avocado)", () => {
		// packages/analyzer/README.md — verbatim.
		const rawDb = {
			avocado: {
				name: "avocado",
				physical: { unit_weight: 150, yield: 0.7 },
			},
			"lemon-juice": {
				name: "lemon juice",
				physical: { density: 1.01 },
			},
		};

		const { rejected } = validateIngredientDatabase(rawDb);
		expect(rejected).toEqual([]);
	});

	it("validates a rice/pasta-style unit_weight-only entry the way gram db enrich would produce", () => {
		const rawDb = {
			egg: { name: "Egg", physical: { unit_weight: 50 } },
		};
		const { data, rejected } = validateIngredientDatabase(rawDb);
		expect(rejected).toEqual([]);
		expect(data.egg?.physical?.unit_weight).toBe(50);
		expect(data.egg?.physical?.density).toBeUndefined();
	});

	it("validates every conformance database.json fixture with zero rejections", () => {
		const casesDir = join(import.meta.dir, "../../../conformance/cases");
		const caseDirs = readdirSync(casesDir);
		let checked = 0;

		for (const caseDir of caseDirs) {
			const dbPath = join(casesDir, caseDir, "database.json");
			if (!existsSync(dbPath)) continue;
			checked++;
			const rawDb = JSON.parse(readFileSync(dbPath, "utf-8"));
			const { rejected } = validateIngredientDatabase(rawDb);
			expect(rejected, `${caseDir}/database.json`).toEqual([]);
		}

		// Guards against this test silently checking nothing if the
		// conformance corpus's location or naming convention ever changes.
		expect(checked).toBeGreaterThan(0);
	});
});

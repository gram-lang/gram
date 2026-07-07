import { describe, it, expect } from "bun:test";
import { calculateNutrition, type NutritionItem } from "../src/nutrition";
import type { IngredientData } from "../src/types";

const database: Record<string, IngredientData> = {
	flour: {
		name: "Flour",
		nutrition: { calories: 364, protein: 10, carbs: 76, fat: 1 },
	},
	sugar: {
		name: "Sugar",
		nutrition: { calories: 400, protein: 0, carbs: 100, fat: 0, sugar: 100 },
	},
	"lemon-juice": {
		name: "Lemon Juice",
		nutrition: { calories: 22, protein: 0.4, carbs: 6.9, fat: 0.2 },
	},
	"lemon-zest": { name: "Lemon Zest" }, // no nutrition block on purpose
	"whipped-cream": {
		name: "Whipped Cream",
		nutrition: { calories: 257, protein: 2.1, carbs: 3.4, fat: 26 },
	},
	butter: {
		name: "Butter",
		nutrition: { calories: 717, protein: 0.9, carbs: 0.1, fat: 81 },
	},
	oil: {
		name: "Oil",
		nutrition: { calories: 884, protein: 0, carbs: 0, fat: 100 },
	},
};

function item(partial: Partial<NutritionItem>): NutritionItem {
	return { id: "", ...partial } as NutritionItem;
}

describe("calculateNutrition — base aggregation", () => {
	it("sums per-100g values proportionally to normalizedMass", () => {
		const result = calculateNutrition(
			[item({ id: "flour", normalizedMass: 200 })],
			database,
		);
		expect(result.total.calories).toBe(Math.round(364 * 2));
		expect(result.total.carbs).toBeCloseTo(76 * 2, 1);
		expect(result.coverage).toBe(1);
	});

	it("reports partial coverage and a total built only from known ingredients", () => {
		const result = calculateNutrition(
			[
				item({ id: "flour", normalizedMass: 100 }),
				item({ id: "mystery-fruit", normalizedMass: 100 }),
			],
			database,
		);
		expect(result.coverage).toBe(0.5);
		expect(result.total.calories).toBe(364);
		expect(result.warnings).toBeDefined();
	});
});

describe("calculateNutrition — optional ingredients", () => {
	it("excludes a top-level optional ingredient from totals and coverage", () => {
		const withOptional = calculateNutrition(
			[
				item({ id: "flour", normalizedMass: 100 }),
				item({
					id: "whipped-cream",
					normalizedMass: 50,
					modifiers: ["optional"],
				}),
			],
			database,
		);
		const withoutOptional = calculateNutrition(
			[item({ id: "flour", normalizedMass: 100 })],
			database,
		);
		expect(withOptional.total).toEqual(withoutOptional.total);
		expect(withOptional.coverage).toBe(1);
	});
});

describe("calculateNutrition — alternatives", () => {
	it("only counts the first (preferred) option", () => {
		const result = calculateNutrition(
			[
				item({
					type: "alternative",
					options: [
						item({ id: "butter", normalizedMass: 50 }),
						item({ id: "oil", normalizedMass: 40 }),
					],
				}),
			],
			database,
		);
		expect(result.total.calories).toBe(Math.round(717 * 0.5));
	});
});

describe("calculateNutrition — composites", () => {
	it("looks up each child independently, with no fallback to a parent entry", () => {
		const result = calculateNutrition(
			[
				item({
					id: "lemon",
					type: "composite",
					usage: [
						item({ id: "lemon-juice", normalizedMass: 30 }),
						item({ id: "lemon-zest", normalizedMass: 5 }),
					],
				}),
			],
			database,
		);
		// lemon-juice contributes its own macros; lemon-zest has no nutrition block
		// and is NOT estimated from a parent — it just lowers coverage.
		expect(result.total.calories).toBe(Math.round(22 * 0.3));
		expect(result.coverage).toBe(0.5);
		expect(result.warnings?.some((w) => w.message.includes("lemon-zest"))).toBe(
			true,
		);
	});
});

describe("calculateNutrition — portions", () => {
	it("divides the total into perPortion when portions > 1", () => {
		const result = calculateNutrition(
			[item({ id: "sugar", normalizedMass: 400 })],
			database,
			4,
		);
		expect(result.perPortion?.calories).toBe(
			Math.round(result.total.calories / 4),
		);
	});

	it("propagates undefined (not 0) for sugar/fiber/sodium when no ingredient has that data", () => {
		// 'flour' and 'lemon-juice' both carry a nutrition block but neither
		// declares sugar/fiber/sodium — a real "unknown", not a real zero.
		const result = calculateNutrition(
			[
				item({ id: "flour", normalizedMass: 100 }),
				item({ id: "lemon-juice", normalizedMass: 100 }),
			],
			database,
			2,
		);
		expect(result.total.sugar).toBeUndefined();
		expect(result.perPortion?.sugar).toBeUndefined();
		expect(result.perPortion?.fiber).toBeUndefined();
		expect(result.perPortion?.sodium).toBeUndefined();
	});

	it("still reports a real sugar value (including a genuine 0) when at least one ingredient has that data", () => {
		const result = calculateNutrition(
			[
				item({ id: "sugar", normalizedMass: 200 }),
				item({ id: "flour", normalizedMass: 100 }),
			],
			database,
			2,
		);
		expect(result.total.sugar).toBe(200); // 100% sugar content * 200g / 100
		expect(result.perPortion?.sugar).toBe(100);
	});
});

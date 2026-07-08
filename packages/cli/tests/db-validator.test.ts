import { describe, it, expect } from "bun:test";
import { validateDb } from "../src/services/db-validator";
import type { IngredientData } from "@gram-lang/analyzer";

function db(
	entries: Record<string, Partial<IngredientData>>,
): Record<string, IngredientData> {
	return Object.fromEntries(
		Object.entries(entries).map(([id, data]) => [
			id,
			{ name: id, ...data } as IngredientData,
		]),
	);
}

describe("validateDb", () => {
	it("reports no issues for a clean, complete database", () => {
		const result = validateDb(
			db({
				flour: {
					physical: { density: 0.59 },
					nutrition: { calories: 364, protein: 10, carbs: 76, fat: 1 },
				},
			}),
			"ingredients.yaml",
		);
		expect(result.issues).toHaveLength(0);
		expect(result.hasErrors).toBe(false);
		expect(result.ingredientCount).toBe(1);
		expect(result.dbPath).toBe("ingredients.yaml");
	});

	it("flags duplicate aliases across different ingredients as an error", () => {
		const result = validateDb(
			db({
				flour: { aliases: ["farine"] },
				wheat: { aliases: ["farine"] },
			}),
			"db.yaml",
		);
		const dupIssue = result.issues.find(
			(i) => i.category === "Coherence" && i.message.includes("farine"),
		);
		expect(dupIssue).toBeDefined();
		expect(dupIssue?.level).toBe("error");
		expect(result.hasErrors).toBe(true);
	});

	it("treats aliases as case-insensitive and trims whitespace when detecting duplicates", () => {
		const result = validateDb(
			db({
				flour: { aliases: ["Farine "] },
				wheat: { aliases: [" farine"] },
			}),
			"db.yaml",
		);
		expect(result.issues.some((i) => i.message.includes("farine"))).toBe(true);
	});

	it("warns on missing density", () => {
		const result = validateDb(db({ flour: {} }), "db.yaml");
		const issue = result.issues.find((i) => i.message.includes("density"));
		expect(issue?.level).toBe("warning");
		expect(issue?.category).toBe("Completeness");
		expect(result.hasErrors).toBe(false);
	});

	it("warns on missing nutrition", () => {
		const result = validateDb(
			db({ flour: { physical: { density: 0.59 } } }),
			"db.yaml",
		);
		const issue = result.issues.find((i) => i.message.includes("nutrition"));
		expect(issue?.level).toBe("warning");
	});

	it("warns on unusually high calorie density (> 900 kcal/100g)", () => {
		const result = validateDb(
			db({
				oil: {
					physical: { density: 0.92 },
					nutrition: { calories: 950, protein: 0, carbs: 0, fat: 100 },
				},
			}),
			"db.yaml",
		);
		const issue = result.issues.find((i) =>
			i.message.includes("calorie density"),
		);
		expect(issue?.level).toBe("warning");
		expect(issue?.category).toBe("Coherence");
	});

	it("does not warn on calorie density at or below 900", () => {
		const result = validateDb(
			db({
				oil: {
					physical: { density: 0.92 },
					nutrition: { calories: 900, protein: 0, carbs: 0, fat: 100 },
				},
			}),
			"db.yaml",
		);
		expect(
			result.issues.some((i) => i.message.includes("calorie density")),
		).toBe(false);
	});

	it("warns on unusually high density (> 2.5 g/ml)", () => {
		const result = validateDb(
			db({ salt: { physical: { density: 2.6 } } }),
			"db.yaml",
		);
		const issue = result.issues.find((i) => i.message.includes("high density"));
		expect(issue?.level).toBe("warning");
	});

	it("flags negative nutrition values as errors", () => {
		const result = validateDb(
			db({
				flour: {
					physical: { density: 0.59 },
					nutrition: { calories: 300, protein: -1, carbs: 70, fat: 1 },
				},
			}),
			"db.yaml",
		);
		const issue = result.issues.find((i) => i.message.includes('"protein"'));
		expect(issue?.level).toBe("error");
		expect(result.hasErrors).toBe(true);
	});

	it("counts ingredients correctly", () => {
		const result = validateDb(db({ a: {}, b: {}, c: {} }), "db.yaml");
		expect(result.ingredientCount).toBe(3);
	});

	it("handles an empty database", () => {
		const result = validateDb({}, "db.yaml");
		expect(result.issues).toHaveLength(0);
		expect(result.ingredientCount).toBe(0);
		expect(result.hasErrors).toBe(false);
	});
});

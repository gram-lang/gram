import { describe, it, expect } from "bun:test";
import { calculateMassMetrics } from "../src/metrics";

describe("calculateMassMetrics — optional ingredients", () => {
	it("excludes an optional ingredient from totalMass, matching calculateNutrition's treatment of calories", () => {
		const withOptional = calculateMassMetrics([
			{ id: "flour", normalizedMass: 100, isEstimate: false },
			{
				id: "garnish",
				normalizedMass: 50,
				isEstimate: false,
				modifiers: ["optional"],
			},
		]);
		const withoutOptional = calculateMassMetrics([
			{ id: "flour", normalizedMass: 100, isEstimate: false },
		]);

		expect(withOptional.totalMass).toBe(withoutOptional.totalMass);
	});

	it("excludes an optional alternative option from totalMass", () => {
		const result = calculateMassMetrics([
			{ id: "flour", normalizedMass: 100, isEstimate: false },
			{
				type: "alternative",
				options: [
					{
						id: "garnish",
						normalizedMass: 50,
						isEstimate: false,
						modifiers: ["optional"],
					},
				],
			},
		]);
		expect(result.totalMass).toBe(100);
	});

	it("still includes a required ingredient at full mass", () => {
		const result = calculateMassMetrics([
			{ id: "flour", normalizedMass: 100, isEstimate: false },
			{ id: "butter", normalizedMass: 50, isEstimate: false },
		]);
		expect(result.totalMass).toBe(150);
	});
});

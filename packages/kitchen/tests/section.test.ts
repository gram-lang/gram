import { describe, it, expect } from "bun:test";
import { aggregateSectionIngredients } from "../src/section";
import type { Usage } from "../src/types";

function usage(overrides: Partial<Usage>): Usage {
	return { id: "sugar", ...overrides } as Usage;
}

describe("aggregateSectionIngredients", () => {
	it("sums normalizedMass across repeated measured occurrences of the same ingredient", () => {
		const [entry] = aggregateSectionIngredients([
			usage({ qty: 100, unit: "g", normalizedMass: 100 }),
			usage({ qty: 100, unit: "g", normalizedMass: 100 }),
		]);
		expect(entry!.normalizedMass).toBe(200);
	});

	it("sums bakersPercentage across repeated occurrences, instead of keeping only the first one's value", () => {
		// Two 100g occurrences of an ingredient at 10% each (reference = 1000g)
		// must aggregate to 200g / 20%, not stay stuck at the first entry's 10%.
		const [entry] = aggregateSectionIngredients([
			usage({
				qty: 100,
				unit: "g",
				normalizedMass: 100,
				bakersPercentage: 10,
			} as any),
			usage({
				qty: 100,
				unit: "g",
				normalizedMass: 100,
				bakersPercentage: 10,
			} as any),
		]);
		expect(entry!.normalizedMass).toBe(200);
		expect((entry as any).bakersPercentage).toBe(20);
	});

	it("does not add a bakersPercentage field when none of the occurrences have one", () => {
		const [entry] = aggregateSectionIngredients([
			usage({ qty: 100, unit: "g", normalizedMass: 100 }),
			usage({ qty: 100, unit: "g", normalizedMass: 100 }),
		]);
		expect((entry as any).bakersPercentage).toBeUndefined();
	});

	it("rounds the summed bakersPercentage to 2 decimals", () => {
		const [entry] = aggregateSectionIngredients([
			usage({
				qty: 1,
				unit: "g",
				normalizedMass: 1,
				bakersPercentage: 0.1,
			} as any),
			usage({
				qty: 1,
				unit: "g",
				normalizedMass: 1,
				bakersPercentage: 0.2,
			} as any),
		]);
		expect((entry as any).bakersPercentage).toBeCloseTo(0.3, 5);
	});
});

describe("composite parent tracking", () => {
	it("attaches the raw parent name to a composite child entry", () => {
		const [entry] = aggregateSectionIngredients([
			usage({
				id: "jus",
				qty: "1/2",
				composite: { parent: "citron" } as any,
			}),
		]);
		expect(entry!.parent).toBe("citron");
	});

	it("does not set parent for a non-composite ingredient", () => {
		const [entry] = aggregateSectionIngredients([
			usage({ qty: 100, unit: "g" }),
		]);
		expect(entry!.parent).toBeUndefined();
	});

	it("keeps the parent across merged repeated uses of the same composite child", () => {
		const [entry] = aggregateSectionIngredients([
			usage({
				id: "jus",
				qty: 50,
				unit: "ml",
				composite: { parent: "citron" } as any,
			}),
			usage({
				id: "jus",
				qty: 30,
				unit: "ml",
				composite: { parent: "citron" } as any,
			}),
		]);
		expect(entry!.parent).toBe("citron");
		expect(entry!.quantities).toHaveLength(2);
	});

	it("attaches the parent's own preparation, distinct from this entry's preparation", () => {
		const [entry] = aggregateSectionIngredients([
			usage({
				id: "jus",
				qty: "1/2",
				preparation: "filtré",
				composite: { parent: "citron", preparation: "coupé en deux" } as any,
			}),
		]);
		expect(entry!.preparation).toBe("filtré");
		expect(entry!.parentPreparation).toBe("coupé en deux");
	});

	it("does not set parentPreparation when the composite has a parent but no preparation", () => {
		const [entry] = aggregateSectionIngredients([
			usage({
				id: "jus",
				qty: "1/2",
				composite: { parent: "citron" } as any,
			}),
		]);
		expect(entry!.parent).toBe("citron");
		expect(entry!.parentPreparation).toBeUndefined();
	});
});

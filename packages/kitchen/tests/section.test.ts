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

describe("alternative group pass-through", () => {
	function alternativeUsage(
		options: Partial<Usage>[],
	): Partial<Usage> & { type: "alternative" } {
		return {
			id: "alternative",
			type: "alternative",
			options: options.map((o) => usage(o)),
		};
	}

	it("includes an alternative group instead of silently dropping it", () => {
		const entries = aggregateSectionIngredients([
			alternativeUsage([
				{ id: "egg", qty: 2 },
				{ id: "egg substitute", qty: 2 },
			]) as any,
		]);
		expect(entries).toHaveLength(1);
		expect(entries[0]!.type).toBe("alternative");
		expect(entries[0]!.options).toHaveLength(2);
	});

	it("keeps two distinct alternative groups in the same section as separate entries", () => {
		// Every alternative group shares the literal id "alternative" — without
		// special-casing them, the measured/unmeasured id-keyed maps would
		// collide two unrelated groups (e.g. "egg or substitute" and "pan or
		// skillet") into a single merged entry.
		const entries = aggregateSectionIngredients([
			alternativeUsage([{ id: "egg" }, { id: "egg substitute" }]) as any,
			alternativeUsage([
				{ id: "pan", type: "cookware" },
				{ id: "skillet", type: "cookware" },
			]) as any,
		]);
		expect(entries).toHaveLength(2);
		expect(entries[0]!.options?.map((o: any) => o.id)).toEqual([
			"egg",
			"egg substitute",
		]);
		expect(entries[1]!.options?.map((o: any) => o.id)).toEqual([
			"pan",
			"skillet",
		]);
	});

	it("passes each option through with its own preparation intact", () => {
		const [entry] = aggregateSectionIngredients([
			alternativeUsage([
				{ id: "egg", qty: 2 },
				{ id: "egg substitute", qty: 2, preparation: "vegan" },
			]) as any,
		]);
		const options = entry!.options as any[];
		expect(options[0].preparation).toBeUndefined();
		expect(options[1].preparation).toBe("vegan");
	});
});

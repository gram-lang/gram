import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile, applyScale } from "@gram-lang/kitchen";
import { analyze } from "../src/index";
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
	water: { name: "Water", physical: { density: 1 } },
};

function run(source: string, options?: Parameters<typeof analyze>[2]) {
	return analyze(compile(getAST(source)), database, options).result;
}

describe("portions resolution", () => {
	it("reads the portion count from the recipe's own frontmatter", () => {
		// The documented behaviour ("if the recipe declares portions: 4, the
		// total is divided by 4") was never actually wired up: analyze() only
		// read an option nobody passed correctly.
		const result = run(`---
title: Cake
portions: 4
---

## Section

Mix @flour{200g}.
`);
		const nut = result.metrics.nutrition;
		expect(nut?.portions).toBe(4);
		expect(nut?.total.calories).toBe(728);
		expect(nut?.perPortion?.calories).toBe(182);
	});

	it("lets an explicit option override the frontmatter", () => {
		const result = run(
			`---
title: Cake
portions: 4
---

## Section

Mix @flour{200g}.
`,
			{ portions: 2 },
		);
		expect(result.metrics.nutrition?.portions).toBe(2);
		expect(result.metrics.nutrition?.perPortion?.calories).toBe(364);
	});

	it("tolerates a labelled count and rejects a nonsensical one", () => {
		const labelled = run(`---
title: Cake
portions: 4 servings
---

## Section

Mix @flour{200g}.
`);
		expect(labelled.metrics.nutrition?.portions).toBe(4);

		const zero = run(`---
title: Cake
portions: 0
---

## Section

Mix @flour{200g}.
`);
		expect(zero.metrics.nutrition?.portions).toBeUndefined();
		expect(zero.metrics.nutrition?.perPortion).toBeUndefined();
	});

	it("keeps per-portion and per-100g figures invariant under scaling", () => {
		const source = `---
title: Cake
portions: 4
---

## Section

Mix @flour{200g} and @sugar{100g}.
`;
		const compiled = compile(getAST(source));
		const base = analyze(compiled, database).result.metrics.nutrition;
		// applyScale scales meta.portions alongside the quantities, so a
		// doubled recipe is still the same food per portion and per 100 g.
		const scaled = analyze(applyScale(compiled, 2), database).result.metrics
			.nutrition;

		expect(scaled?.total.calories).toBe((base?.total.calories ?? 0) * 2);
		expect(scaled?.perPortion).toEqual(base?.perPortion);
		expect(scaled?.per100g).toEqual(base?.per100g);
	});

	it("still reports per-100g for a recipe that declares no portions", () => {
		const nut = run(`---
title: Cake
---

## Section

Mix @flour{200g}.
`).metrics.nutrition;

		expect(nut?.perPortion).toBeUndefined();
		expect(nut?.per100g?.calories).toBe(364);
		expect(nut?.basis).toEqual({ mass: 200, massStatus: "precise" });
	});
});

describe("mass metrics vs. relative quantities", () => {
	it("counts an ingredient expressed as a percentage of another", () => {
		// Mass metrics used to be computed before relative quantities were
		// resolved, so `water` had no normalizedMass yet: it was reported as
		// missing and left out of totalMass, while the nutrition pass — which
		// runs after resolution — did include it.
		const result = run(`---
title: Dough
---

## Section

Mix @flour{250g} and @water{60% @&flour}.
`);

		expect(result.metrics.totalMass).toBe(400);
		expect(result.metrics.massStatus).toBe("precise");
		expect(result.metrics.missingMassIngredients).toEqual([]);
		expect(result.sections[0]?.metrics?.totalMass).toBe(400);
	});
});

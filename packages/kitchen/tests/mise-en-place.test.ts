import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src/index";
import { KITCHEN_VERSION } from "../src/version";

const RECIPE = `## Dough ->&dough

Mix @flour{500g} and @water{300ml} in a #bowl.

[Rest] Let it rest ~_{2h}.

## Filling

Slice @onions{200g}(finely sliced).

## Assembly

Combine &dough and the filling, then bake for ~{25min}.
`;

describe("compiled mise en place and schedules", () => {
	it("stamps the compiler version in `generator`", () => {
		const result = compile(getAST(RECIPE));
		expect(result.generator).toBe(`@gram-lang/kitchen@${KITCHEN_VERSION}`);
		expect(KITCHEN_VERSION).toMatch(/^\d+\.\d+\.\d+/);
	});

	it("does not scale durations: mise en place and schedules ignore the scale factor", () => {
		const base = compile(getAST(RECIPE));
		const scaled = compile(getAST(RECIPE), { scaleFactor: 3 });

		expect(scaled.miseEnPlace).toEqual(base.miseEnPlace);
		expect(scaled.schedules).toEqual(base.schedules);
		expect(scaled.metrics.preparationTime).toBe(base.metrics.preparationTime);
	});

	it("keeps `miseEnPlace` and the schedules present, and empty, for an empty recipe", () => {
		const result = compile(getAST(""));
		expect(result.miseEnPlace).toEqual([]);
		expect(result.schedules.perSection.blocks).toEqual([]);
		expect(result.schedules.upfront.blocks).toEqual([]);
		expect(result.schedules.perSection.totalTime).toBe(0);
	});

	it("keeps the deprecated fields' values and meaning", () => {
		const result = compile(getAST(RECIPE));
		// The legacy total is the upfront timeline's total.
		expect(result.metrics.totalTime).toBe(result.schedules.upfront.totalTime);
		expect(result.metrics.preparationTime).toBe(
			result.miseEnPlace.reduce((sum, m) => sum + m.duration, 0),
		);
	});
});

describe("gathering skips what the recipe makes itself", () => {
	const SOURCE = `## Dough ->&dough

Mix @flour{500g} and @water{300ml}.

## Filling ->&filling

Cook @onions{200g}(finely sliced).

## Assembly

Spread &filling over &dough.
`;

	it("charges nothing for an intermediate", () => {
		const result = compile(getAST(SOURCE));
		const gathered = result.miseEnPlace.flatMap((m) =>
			m.items.flatMap((i) =>
				i.kind === "gather" && i.target === "ingredient" ? [i.count] : [],
			),
		);
		// flour, water, onions — not dough, not filling.
		expect(gathered.reduce((a, b) => a + b, 0)).toBe(3);
		expect(result.metrics.preparationTime).toBe(5);
	});

	it("still lists the intermediates in the registry", () => {
		const result = compile(getAST(SOURCE));
		expect(result.registry.ingredients.dough?.is_intermediate).toBe(true);
		expect(result.registry.ingredients.filling?.is_intermediate).toBe(true);
	});

	it("keeps the section that only assembles free of any gathering", () => {
		const result = compile(getAST(SOURCE));
		expect(result.miseEnPlace.map((m) => m.section)).toEqual([0, 1]);
	});
});

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

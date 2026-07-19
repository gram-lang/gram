import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src/index";

describe("Processor ALAP Scheduling", () => {
	it("complex backward chaining with an independent step between timer and consumer", () => {
		const source = `
## ALAP Section

[Preheat] The oven for ~_{15m}. ->&oven

[Prepare] The dough.

[Bake] In the &oven.
`;
		const ast = getAST(source);
		const result = compile(ast);

		const steps = result.sections[0].steps.filter((s) => s.type === "step");

		// Step 0: Preheat. Active: 0, Timer: 15m.
		expect(steps[0].timings.start).toBe(0);
		expect(steps[0].timings.end).toBe(0);

		// Step 1: Prepare Dough. Active: 2 (fallback).
		// ALAP pulls this to start at 13, right before Bake.
		expect(steps[1].timings.start).toBe(13);
		expect(steps[1].timings.end).toBe(15);

		// Step 2: Bake. Active: 2 (fallback). Needs &oven.
		// Wait for &oven (15m timer finishes at 15).
		expect(steps[2].timings.start).toBe(15);
		expect(steps[2].timings.end).toBe(17);
	});
});

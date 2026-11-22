import { describe, expect, it } from "bun:test";
import { getAST } from "../src";

/** Best of three, in ms: a GC pause or a cold JIT only ever adds time. */
function best(fn: () => unknown): number {
	let min = Number.POSITIVE_INFINITY;
	for (let i = 0; i < 3; i++) {
		const start = performance.now();
		fn();
		min = Math.min(min, performance.now() - start);
	}
	return min;
}

const TERMS = 6_250; // 50 000 characters
const sum = `Add @flour{${"1-2 g + ".repeat(TERMS)}1 g}.`;
const prose = `Add flour ${"1-2 g + ".repeat(TERMS)}1 g.`;

describe("a sum of quantities", () => {
	// Each term used to read `ops.children[i]`, which ohm rebuilds on every
	// access: n terms cost n². The same characters as prose are the yardstick,
	// so the machine's speed cancels out: a sum measures about 3× its prose,
	// 5.6× before the fix, and more as the sum grows. A busy CI runner can push
	// one measurement past 4, hardly three in a row: n² fails every attempt.
	it("parses in linear time", () => {
		getAST(sum); // warm-up
		getAST(prose);
		const ratios: number[] = [];
		for (let attempt = 0; attempt < 3; attempt++) {
			const ratio = best(() => getAST(sum)) / best(() => getAST(prose));
			if (ratio < 4) return;
			ratios.push(ratio);
		}
		expect(Math.min(...ratios)).toBeLessThan(4);
	}, 60_000);

	it("keeps the sign of every term", () => {
		const ast = JSON.stringify(getAST("Add @flour{1 cup + 2 tbsp - 1 tsp}.\n"));
		expect(ast.match(/"minus":true/g)?.length).toBe(1);
		expect(ast.match(/"unit":"/g)?.length).toBe(3);
	});
});

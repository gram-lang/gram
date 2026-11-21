import { describe, expect, it } from "bun:test";
import { createRng, iterationSeed } from "../src/prng";

describe("createRng", () => {
	it("produces a frozen sequence for a given seed", () => {
		const rng = createRng(0x6772616d);
		const sequence = Array.from({ length: 5 }, () => rng.int(0, 1_000_000));
		// Changing this sequence changes every fuzz input: do it on purpose only.
		expect(sequence).toMatchSnapshot();
	});

	it("stays within bounds", () => {
		const rng = createRng(42);
		for (let i = 0; i < 10_000; i++) {
			const n = rng.int(3, 7);
			expect(n >= 3 && n <= 7).toBe(true);
			const f = rng.next();
			expect(f >= 0 && f < 1).toBe(true);
		}
	});

	it("gives each iteration its own seed", () => {
		const seeds = new Set(
			Array.from({ length: 1000 }, (_, i) => iterationSeed(1, i)),
		);
		expect(seeds.size).toBe(1000);
	});
});

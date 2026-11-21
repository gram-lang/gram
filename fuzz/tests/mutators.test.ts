import { describe, expect, it } from "bun:test";
import { MUTATORS, mutate } from "../src/mutators";
import { createRng } from "../src/prng";
import { generateInput } from "../src/run";

const SOURCE =
	"## Dough\n\nMix @flour{500 g} with @water{300 ml}.\n\nRest ~{20 min}.\n";
const corpus = [
	{ id: "a", content: SOURCE },
	{ id: "b", content: "Bake in #oven at ^{180°C}.\n" },
];

describe("mutators", () => {
	it("are deterministic for a given seed", () => {
		for (const m of MUTATORS) {
			const ctx = { donors: corpus.map((c) => c.content) };
			expect(m.apply(SOURCE, createRng(7), ctx)).toBe(
				m.apply(SOURCE, createRng(7), ctx),
			);
		}
	});

	it("stack one to four mutations", () => {
		for (let seed = 0; seed < 200; seed++) {
			const { applied } = mutate(SOURCE, createRng(seed), { donors: [] });
			expect(applied.length).toBeGreaterThanOrEqual(1);
			expect(applied.length).toBeLessThanOrEqual(4);
		}
	});

	it("survive an empty source", () => {
		for (const m of MUTATORS)
			expect(typeof m.apply("", createRng(1), { donors: [] })).toBe("string");
	});

	it("make an input a pure function of (seed, index, corpus)", () => {
		expect(generateInput(5, 17, corpus)).toEqual(generateInput(5, 17, corpus));
		expect(generateInput(5, 17, corpus)).not.toEqual(
			generateInput(5, 18, corpus),
		);
	});
});

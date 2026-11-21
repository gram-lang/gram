import { describe, expect, it } from "bun:test";
import { shrink } from "../src/shrink";

describe("shrink", () => {
	it("keeps only what makes the predicate fail", () => {
		const input =
			"## A\n\nMix @flour{500 g}.\n\nAdd @*salt and @*sugar.\n\nBake.\n";
		const min = shrink(input, (c) => (c.match(/@\*/g) ?? []).length >= 2);
		expect(min).toBe("@*@*");
	});

	it("returns the input when nothing can be removed", () => {
		expect(shrink("x", (c) => c === "x")).toBe("x");
	});
});

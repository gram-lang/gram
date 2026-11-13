import { describe, expect, it } from "bun:test";
import { fmtMass, fmtQty } from "../src/ui/cook/prepare";

describe("gram cook quantities", () => {
	it("writes cups and spoons as the recipe view does (1 3/4 cup)", () => {
		expect(fmtQty({ qty: 1.75, unit: "cup" })).toBe(" 1 3/4 cup");
		expect(fmtQty({ qty: 0.5, unit: "tsp" })).toBe(" 1/2 tsp");
	});

	it("rounds a computed quantity rather than showing every decimal", () => {
		expect(fmtQty({ qty: 1.33333, unit: "g" })).toBe(" 1.3 g");
		expect(fmtQty({ qty: 2, unit: null })).toBe(" 2");
	});

	it("keeps a quantity written as text (a range, a fraction) as written", () => {
		expect(fmtQty({ qty: { type: "range", value: 2.5, text: "2-3" } })).toBe(
			" 2-3",
		);
	});

	it("shows a weighed mass in grams, even past 1000", () => {
		expect(fmtMass(1500)).toBe("1500 g");
	});
});

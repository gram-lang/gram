import { describe, expect, it } from "bun:test";
import { formatDecimalToFraction, formatGrams } from "../src/shared/utils";

// #230: a quantity is shown rounded to its size, not to a decimal of its
// unit: `0.15 kg` read `0.2 kg`, `0.02 kg` read `0 kg`, `0.05 l` read
// `0.1 l`, and a pinch of saffron `0 g`.
describe("a quantity as a cook reads it (#230)", () => {
	for (const [value, unit, shown] of [
		[0.03, "g", "0.03"],
		[0.004, "g", "0.004"],
		[0.02, "kg", "0.02"],
		[0.15, "kg", "0.15"],
		[1.15, "kg", "1.15"],
		[0.05, "l", "0.05"],
		[152.37, "g", "152"],
		[15.24, "g", "15.2"],
		[0.5, "cup", "1/2"],
		[0.25, "kg", "1/4"],
	] as const) {
		it(`shows ${value} ${unit} as ${shown} ${unit}`, () => {
			expect(formatDecimalToFraction(value, unit)).toBe(shown);
		});
	}

	it("writes a decimal comma in French", () => {
		expect(formatDecimalToFraction(0.15, "kg", { lang: "fr" })).toBe("0,15");
	});

	it("keeps one decimal for a weight in grams, more below 1 g", () => {
		expect(formatGrams(147.5)).toBe("147.5 g");
		expect(formatGrams(0.03)).toBe("0.03 g");
		expect(formatGrams(0.0047)).toBe("0.0047 g");
	});
});

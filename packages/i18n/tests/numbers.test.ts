import { describe, expect, it } from "bun:test";
import {
	commonFraction,
	decimalSeparator,
	formatNumber,
	localizeDecimals,
	toKitchenFraction,
} from "../src/numbers";

describe("formatNumber", () => {
	it("writes the decimal separator of the reader's language", () => {
		expect(formatNumber(1.5, "en")).toBe("1.5");
		expect(formatNumber(1.5, "fr")).toBe("1,5");
		expect(formatNumber(1.5)).toBe("1.5");
	});

	it("rounds to 2 decimals by default, or to the ones asked", () => {
		expect(formatNumber(1.23456, "fr")).toBe("1,23");
		expect(formatNumber(147.46, "fr", 1)).toBe("147,5");
		expect(formatNumber(3, "fr")).toBe("3");
	});

	it("writes no thousands separator, as a recipe does (1500 g)", () => {
		expect(formatNumber(1500, "en")).toBe("1500");
		expect(formatNumber(12500.5, "fr")).toBe("12500,5");
	});

	it("falls back to English for a language tag it cannot read", () => {
		expect(formatNumber(1.5, "not a language!")).toBe("1.5");
	});
});

describe("decimalSeparator", () => {
	it("is a point in English, a comma in French", () => {
		expect(decimalSeparator("en")).toBe(".");
		expect(decimalSeparator("fr")).toBe(",");
	});
});

describe("localizeDecimals", () => {
	it("changes the points between two digits only", () => {
		expect(localizeDecimals("1.5-2", "fr")).toBe("1,5-2");
		expect(localizeDecimals("1/2", "fr")).toBe("1/2");
		expect(localizeDecimals("2 c.à.s", "fr")).toBe("2 c.à.s");
		expect(localizeDecimals("1.5", "en")).toBe("1.5");
	});
});

describe("toKitchenFraction", () => {
	it("writes a spoon, cup or imperial quantity as a whole number and a common fraction", () => {
		expect(toKitchenFraction(1.75, "cup")).toBe("1 3/4");
		expect(toKitchenFraction(2.5, "tbsp")).toBe("2 1/2");
		expect(toKitchenFraction(1 + 1 / 3, "tasse", "fr")).toBe("1 1/3");
		expect(toKitchenFraction(0.5, "tsp")).toBe("1/2");
		expect(toKitchenFraction(1.875, "cups")).toBe("1 7/8");
		expect(toKitchenFraction(1.5, "lb")).toBe("1 1/2");
	});

	it("gives nothing when no common fraction is near, or for a whole number", () => {
		expect(toKitchenFraction(1.6, "cup")).toBeUndefined();
		expect(toKitchenFraction(2, "cup")).toBeUndefined();
	});

	it("gives nothing for a metric unit or a count: they keep decimals", () => {
		expect(toKitchenFraction(1.5, "kg")).toBeUndefined();
		expect(toKitchenFraction(1.25, "l")).toBeUndefined();
		expect(toKitchenFraction(2.5, "")).toBeUndefined();
		expect(toKitchenFraction(2.5, null)).toBeUndefined();
	});
});

describe("commonFraction", () => {
	it("is a fraction a cook reads, strictly between 0 and 1", () => {
		expect(commonFraction(0.25)).toBe("1/4");
		expect(commonFraction(2 / 3)).toBe("2/3");
		expect(commonFraction(0.3)).toBeUndefined();
		expect(commonFraction(0)).toBeUndefined();
		expect(commonFraction(1)).toBeUndefined();
	});
});

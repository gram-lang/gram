import { describe, it, expect } from "bun:test";
import { normalizeUnit } from "../src/units";

describe("normalizeUnit", () => {
	it("normalizes an English alias to its canonical unit", () => {
		expect(normalizeUnit("tablespoons")).toBe("tbsp");
	});

	it("normalizes a French alias to its canonical unit (« pincée » -> pinch)", () => {
		expect(normalizeUnit("pincée")).toBe("pinch");
		expect(normalizeUnit("pincee")).toBe("pinch");
	});

	it("is case-insensitive and trims whitespace", () => {
		expect(normalizeUnit(" CUILLÈRE À SOUPE ")).toBe("tbsp");
	});

	it("resolves a language-specific alias when that language is given explicitly", () => {
		expect(normalizeUnit("pinte", "fr")).toBe("pt");
	});

	it("also resolves a language-specific alias via the merged global lookup when no language is given", () => {
		expect(normalizeUnit("kilogramme")).toBe("kg");
	});

	it("returns the input unchanged when it isn't a known alias", () => {
		expect(normalizeUnit("smidgeon-and-a-half")).toBe("smidgeon-and-a-half");
	});

	it("returns an empty string for null/undefined/empty input", () => {
		expect(normalizeUnit(null)).toBe("");
		expect(normalizeUnit(undefined)).toBe("");
		expect(normalizeUnit("")).toBe("");
	});
});

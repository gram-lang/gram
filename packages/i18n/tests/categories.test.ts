import { describe, it, expect } from "bun:test";
import { getDefaultCategories } from "../src/categories";

describe("getDefaultCategories", () => {
	it("returns the French category list", () => {
		expect(getDefaultCategories("fr")).toContain("Légumes");
	});

	it("returns the English category list", () => {
		expect(getDefaultCategories("en")).toContain("Vegetables");
	});

	it("defaults to English when no language is given", () => {
		expect(getDefaultCategories()).toEqual(getDefaultCategories("en"));
	});

	it("falls back to English for an unsupported language", () => {
		expect(getDefaultCategories("de")).toEqual(getDefaultCategories("en"));
	});
});

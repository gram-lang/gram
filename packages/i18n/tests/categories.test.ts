import { describe, it, expect } from "bun:test";
import {
	getDefaultCategories,
	getCategoryLabels,
	isCategoryKey,
	CATEGORY_KEYS,
} from "../src/categories";

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

// Audit 2026-07-22, i18n finding F-03, Phase 18: CATEGORY_KEYS is the stable,
// non-translated identity meant to be persisted as data; getCategoryLabels
// is display-only. Unlike the old positional-array design, a locale missing
// a key is now a compile-time error (Record<CategoryKey, string> requires
// every key) — these tests pin that guarantee at runtime too, and the
// key<->label roundtrip the rest of the fix (db-enricher, shopper) depends on.
describe("CATEGORY_KEYS / getCategoryLabels / isCategoryKey", () => {
	it("every locale has a label for every category key (parity, can't drift like two positional arrays could)", () => {
		for (const lang of ["en", "fr"]) {
			const labels = getCategoryLabels(lang);
			expect(Object.keys(labels).sort()).toEqual([...CATEGORY_KEYS].sort());
		}
	});

	it("getDefaultCategories is exactly getCategoryLabels' values, in CATEGORY_KEYS order", () => {
		for (const lang of ["en", "fr"]) {
			const labels = getCategoryLabels(lang);
			expect(getDefaultCategories(lang)).toEqual(
				CATEGORY_KEYS.map((key) => labels[key]),
			);
		}
	});

	it("isCategoryKey recognizes every stable key and rejects a translated label", () => {
		for (const key of CATEGORY_KEYS) {
			expect(isCategoryKey(key)).toBe(true);
		}
		expect(isCategoryKey("Vegetables")).toBe(false);
		expect(isCategoryKey("Légumes")).toBe(false);
		expect(isCategoryKey("not-a-category")).toBe(false);
	});
});

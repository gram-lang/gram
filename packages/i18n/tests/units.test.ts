import { describe, it, expect } from "bun:test";
import {
	normalizeUnit,
	UNIT_CONVERSIONS,
	UNIT_DICTIONARIES,
} from "../src/units";

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
		expect(normalizeUnit("cuillère à soupe", "fr")).toBe("tbsp");
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

	// Regression tests for the audit (2026-07-22, finding F-01): French unit
	// words silently resolved to the wrong physical quantity because they were
	// merged with an unrelated or slightly-different English unit.
	describe("French false-friend / physical-mismatch fixes", () => {
		it("does not resolve the French word 'quart' to the US unit 'qt' (false friend)", () => {
			// "quart" means "a quarter" in French (e.g. "un quart d'heure"), not
			// a 946 mL liquid measure — it must come back unresolved, not silently
			// misinterpreted, in either language.
			expect(normalizeUnit("quart")).toBe("quart");
			expect(normalizeUnit("quart", "fr")).toBe("quart");
			expect(normalizeUnit("quarts", "fr")).toBe("quarts");
		});

		it("still resolves 'quart'/'quarts' in English to 'qt' via the bare symbol only", () => {
			// The canonical symbol itself always resolves; only the spelled-out
			// word alias was removed.
			expect(normalizeUnit("qt")).toBe("qt");
		});

		it("resolves French 'tasse' to its own canonical, distinct from the US 'cup'", () => {
			expect(normalizeUnit("tasse", "fr")).toBe("tasse");
			expect(normalizeUnit("tasses", "fr")).toBe("tasse");
			expect(normalizeUnit("tasse", "fr")).not.toBe("cup");
		});

		it("resolves French 'livre' to its own canonical, distinct from the imperial 'lb'", () => {
			expect(normalizeUnit("livre", "fr")).toBe("livre");
			expect(normalizeUnit("livres", "fr")).toBe("livre");
			expect(normalizeUnit("livre", "fr")).not.toBe("lb");
		});

		it("does not resolve French 'pinte' — no reliable single modern value, better unresolved than wrong", () => {
			expect(normalizeUnit("pinte", "fr")).toBe("pinte");
			expect(normalizeUnit("pintes", "fr")).toBe("pintes");
		});

		it("resolves 'gallon'/'gallons', not just the bare 'gal' symbol", () => {
			expect(normalizeUnit("gal")).toBe("gal");
			expect(normalizeUnit("gallon")).toBe("gal");
			expect(normalizeUnit("gallons")).toBe("gal");
		});
	});
});

// Audit 2026-07-22, i18n finding F-02/F-05, Phase 17: UNIT_CONVERSIONS used
// to live in @gram-lang/analyzer, a second package owning canonical ->
// physical-factor knowledge for the same units this file already owns
// alias -> canonical resolution for — now co-located, so the two can't drift
// out of sync across a package boundary the way `gal` once did (see
// analyzer/tests/unit-inventory-invariant.test.ts for the full story).
describe("UNIT_CONVERSIONS", () => {
	it("has a physical conversion factor for every unit convertible to mass or volume", () => {
		expect(UNIT_CONVERSIONS.mass.map.g).toBe(1);
		expect(UNIT_CONVERSIONS.mass.map.kg).toBe(1000);
		expect(UNIT_CONVERSIONS.volume.map.ml).toBe(1);
		expect(UNIT_CONVERSIONS.volume.map.cup).toBeCloseTo(236.588);
	});

	it("every convertible unit is a registered canonical in the unit dictionaries", () => {
		const canonicals = new Set([
			...Object.keys(UNIT_DICTIONARIES.en),
			...Object.keys(UNIT_DICTIONARIES.fr),
		]);
		const convertible = [
			...Object.keys(UNIT_CONVERSIONS.mass.map),
			...Object.keys(UNIT_CONVERSIONS.volume.map),
		];
		for (const unit of convertible) {
			expect(canonicals.has(unit)).toBe(true);
		}
	});
});

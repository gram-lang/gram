import { describe, it, expect } from "bun:test";
import {
	normalizeUnit,
	unitKey,
	UNIT_CONVERSIONS,
	UNIT_DICTIONARIES,
	isMetricMassUnit,
	toLargerMetricUnit,
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

	it("resolves abbreviation-dot, spacing and accent variants to the same canonical unit", () => {
		for (const v of ["c.à.s", "c. à s.", "c.a.s", "càs", "CAS", "c à s"]) {
			expect(normalizeUnit(v)).toBe("tbsp");
			expect(normalizeUnit(v, "fr")).toBe("tbsp");
		}
		for (const v of ["c.à.c", "c. à c.", "c.a.c", "càc"]) {
			expect(normalizeUnit(v)).toBe("tsp");
		}
		expect(normalizeUnit("fl. oz.")).toBe("fl oz");
	});

	it("keeps an unknown unit exactly as written (lowercased), never its folded key", () => {
		expect(normalizeUnit("Foo.Bar")).toBe("foo.bar");
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

describe("unitKey", () => {
	it("folds case, diacritics, dots, apostrophes and spaces", () => {
		expect(unitKey("C. À S.")).toBe("cas");
	});

	it("never maps two different canonical units onto the same folded key", () => {
		const seen = new Map<string, string>();
		for (const dict of Object.values(UNIT_DICTIONARIES)) {
			for (const [canonical, aliases] of Object.entries(dict)) {
				for (const alias of [canonical, ...aliases]) {
					const key = unitKey(alias);
					const prev = seen.get(key);
					expect(prev === undefined || prev === canonical).toBe(true);
					seen.set(key, canonical);
				}
			}
		}
	});
});

describe("isMetricMassUnit", () => {
	it("is true for g, kg and mg, in any spelling the dictionaries know", () => {
		for (const unit of ["g", "kg", "mg", "kilo", "grammes"]) {
			expect(isMetricMassUnit(unit, "fr")).toBe(true);
		}
	});

	it("is false for an imperial mass, a volume, a count or no unit", () => {
		for (const unit of ["oz", "lb", "ml", "cup", "", null, undefined]) {
			expect(isMetricMassUnit(unit)).toBe(false);
		}
	});
});

describe("toLargerMetricUnit", () => {
	it("moves a mass of 1000 g or more to kilograms, rounded to 2 decimals", () => {
		expect(toLargerMetricUnit(3900, "g")).toEqual({ value: 3.9, unit: "kg" });
		expect(toLargerMetricUnit(1000, "g")).toEqual({ value: 1, unit: "kg" });
		expect(toLargerMetricUnit(1234, "g")).toEqual({ value: 1.23, unit: "kg" });
		expect(toLargerMetricUnit(1500000, "mg")).toEqual({
			value: 1.5,
			unit: "kg",
		});
	});

	it("moves a volume of 1000 ml or more to liters, from ml, cl or dl", () => {
		expect(toLargerMetricUnit(2250, "ml")).toEqual({ value: 2.25, unit: "l" });
		expect(toLargerMetricUnit(150, "cl")).toEqual({ value: 1.5, unit: "l" });
		expect(toLargerMetricUnit(12, "dl")).toEqual({ value: 1.2, unit: "l" });
	});

	it("reads the unit through the dictionaries (grammes, millilitres)", () => {
		expect(toLargerMetricUnit(2000, "grammes", "fr")).toEqual({
			value: 2,
			unit: "kg",
		});
	});

	it("leaves as it was an amount under 1000, one already large, or another unit", () => {
		expect(toLargerMetricUnit(999, "g")).toEqual({ value: 999, unit: "g" });
		expect(toLargerMetricUnit(50, "cl")).toEqual({ value: 50, unit: "cl" });
		expect(toLargerMetricUnit(2.5, "kg")).toEqual({ value: 2.5, unit: "kg" });
		expect(toLargerMetricUnit(3, "l")).toEqual({ value: 3, unit: "l" });
		expect(toLargerMetricUnit(64, "oz")).toEqual({ value: 64, unit: "oz" });
		expect(toLargerMetricUnit(12, "cup")).toEqual({ value: 12, unit: "cup" });
		expect(toLargerMetricUnit(1200, null)).toEqual({ value: 1200, unit: "" });
	});
});

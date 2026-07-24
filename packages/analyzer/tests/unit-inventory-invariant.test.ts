import { describe, it, expect } from "bun:test";
import { UNIT_DICTIONARIES, UNIT_CONVERSIONS } from "@gram-lang/i18n";

// Regression test for the audit (2026-07-22, i18n finding I5 / analyzer §5(a)):
// the "units" domain used to be split across two packages with no mechanical
// link — i18n owned the alias -> canonical table, analyzer owned the
// canonical -> physical-factor table — so they silently drifted apart. `gal`
// existed in analyzer's UNIT_CONVERSIONS but not in i18n's dictionaries at
// all: `{1 gal}` worked only by accident (normalizeUnit's fallback returns
// unrecognized input unchanged, and "gal" happened to already equal its own
// canonical), while `{1 gallon}`/`{1 gallons}` silently failed. A test
// asserting `normalizeUnit(unit) === unit` would NOT have caught this —
// that's true for *any* unrecognized string. This test checks actual
// dictionary membership instead, in both directions.
//
// Phase 17: `UNIT_CONVERSIONS` now lives in `@gram-lang/i18n` itself
// (previously `@gram-lang/analyzer`) — this test moved with it in spirit
// (kept here, in analyzer's suite, since analyzer is still the package that
// actually consumes both tables together for mass standardization) but now
// imports both from the same package, so the "drift across a package
// boundary" this test was written for can no longer happen structurally;
// it's kept as a same-package invariant regardless.

describe("UNIT_CONVERSIONS <-> i18n unit dictionaries stay in sync", () => {
	const registeredUnits = new Set([
		...Object.keys(UNIT_DICTIONARIES.en),
		...Object.keys(UNIT_DICTIONARIES.fr),
	]);

	const convertibleUnits = new Set([
		...Object.keys(UNIT_CONVERSIONS.mass.map),
		...Object.keys(UNIT_CONVERSIONS.volume.map),
	]);

	for (const unit of convertibleUnits) {
		it(`"${unit}" (convertible in analyzer) is a registered i18n unit key`, () => {
			expect(registeredUnits.has(unit)).toBe(true);
		});
	}

	for (const unit of registeredUnits) {
		it(`"${unit}" (registered in i18n) has a conversion factor in analyzer`, () => {
			expect(convertibleUnits.has(unit)).toBe(true);
		});
	}
});

import { describe, it, expect } from "bun:test";
import {
	ladderOf,
	sameLadder,
	UNIT_CONVERSIONS,
	UNIT_DICTIONARIES,
	UNIT_LADDERS,
} from "../src/units";

// The ladders state exact whole-number ratios (1 cup = 48 tsp), the
// conversion table rounded factors in grams / milliliters (cup: 236.588,
// tsp: 4.9289, so 48 × 4.9289 = 236.5872). Both must tell the same story:
// every ratio of a ladder agrees with the conversion table to 0.01%,
// relatively. Same spirit as analyzer's `unit-inventory-invariant.test.ts`.
const TOLERANCE = 1e-4;

describe("UNIT_LADDERS agree with UNIT_CONVERSIONS", () => {
	const registered = new Set([
		...Object.keys(UNIT_DICTIONARIES.en),
		...Object.keys(UNIT_DICTIONARIES.fr),
	]);

	for (const ladder of UNIT_LADDERS) {
		const factors = UNIT_CONVERSIONS[ladder.family].map;
		const entries = Object.entries(ladder.steps);
		const [smallest, one] = entries[0] as [string, number];

		it(`${ladder.id} starts at 1 and climbs in whole numbers`, () => {
			expect(one).toBe(1);
			for (const [, size] of entries) expect(Number.isInteger(size)).toBe(true);
		});

		for (const [unit, size] of entries) {
			it(`${ladder.id}: ${unit} is a registered ${ladder.family} unit`, () => {
				expect(registered.has(unit)).toBe(true);
				expect(factors[unit]).toBeDefined();
			});

			it(`${ladder.id}: 1 ${unit} = ${size} ${smallest} within 0.01%`, () => {
				const ratio = (factors[unit] as number) / (factors[smallest] as number);
				expect(Math.abs(ratio - size) / size).toBeLessThan(TOLERANCE);
			});
		}
	}

	it("puts a unit on one ladder at most", () => {
		const seen = new Set<string>();
		for (const ladder of UNIT_LADDERS) {
			for (const unit of Object.keys(ladder.steps)) {
				expect(seen.has(unit)).toBe(false);
				seen.add(unit);
			}
		}
	});
});

describe("ladderOf", () => {
	it("finds a unit's ladder under any spelling", () => {
		expect(ladderOf("cups")).toMatchObject({ unit: "cup", size: 48 });
		expect(ladderOf("càs")?.ladder.id).toBe("usVolume");
		expect(ladderOf("kilo")).toMatchObject({ unit: "kg", size: 1_000_000 });
		expect(ladderOf("livres", "fr")).toMatchObject({ unit: "livre" });
		expect(ladderOf("lb")?.ladder.id).toBe("imperialMass");
	});

	it("finds no ladder for a unit on none", () => {
		expect(ladderOf("pinch")).toBeNull();
		expect(ladderOf("gousse")).toBeNull();
		expect(ladderOf(null)).toBeNull();
		expect(ladderOf("")).toBeNull();
	});
});

describe("sameLadder", () => {
	it("is true for units of one ladder", () => {
		expect(sameLadder(["cup", "tbsp", "tsp"])).toBe(true);
		expect(sameLadder(["g", "kg"])).toBe(true);
		expect(sameLadder(["tasse", "dl"])).toBe(true);
	});

	it("is false across systems, families, or off any ladder", () => {
		expect(sameLadder(["cup", "ml"])).toBe(false);
		expect(sameLadder(["oz", "g"])).toBe(false);
		expect(sameLadder(["cup", "g"])).toBe(false);
		expect(sameLadder(["tsp", "pinch"])).toBe(false);
		expect(sameLadder([])).toBe(false);
	});
});

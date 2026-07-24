import { describe, it, expect } from "bun:test";
import {
	resolveTimeUnit,
	TIME_TO_MINUTES,
	TIME_DICTIONARIES,
} from "../src/time";

describe("resolveTimeUnit", () => {
	it("normalizes English time units", () => {
		expect(resolveTimeUnit("minutes")).toBe("m");
		expect(resolveTimeUnit("hours")).toBe("h");
		expect(resolveTimeUnit("seconds")).toBe("s");
		expect(resolveTimeUnit("day")).toBe("d");
		expect(resolveTimeUnit("days")).toBe("d");
	});

	it("normalizes French time units", () => {
		expect(resolveTimeUnit("heures", "fr")).toBe("h");
		expect(resolveTimeUnit("secondes", "fr")).toBe("s");
		expect(resolveTimeUnit("jour", "fr")).toBe("d");
		expect(resolveTimeUnit("jours", "fr")).toBe("d");
		expect(resolveTimeUnit("j", "fr")).toBe("d");
	});

	it("is case-insensitive and trims whitespace", () => {
		expect(resolveTimeUnit(" MIN ")).toBe("m");
	});

	it("returns the input unchanged when it isn't a known alias", () => {
		expect(resolveTimeUnit("fortnight")).toBe("fortnight");
	});

	it("returns an empty string for null/undefined/empty input", () => {
		expect(resolveTimeUnit(null)).toBe("");
		expect(resolveTimeUnit(undefined)).toBe("");
		expect(resolveTimeUnit("")).toBe("");
	});
});

// Audit 2026-07-22, i18n finding F-02/F-05, Phase 17: TIME_TO_MINUTES used to
// be inlined as bare multipliers inside @gram-lang/kitchen's
// quantityToMinutes, disconnected from the unit-name resolution above.
describe("TIME_TO_MINUTES", () => {
	it("has the expected conversion factor for every canonical time unit", () => {
		expect(TIME_TO_MINUTES.d).toBe(1440);
		expect(TIME_TO_MINUTES.h).toBe(60);
		expect(TIME_TO_MINUTES.m).toBe(1);
		expect(TIME_TO_MINUTES.s).toBeCloseTo(1 / 60);
	});

	it("has a factor for every canonical time unit declared in the dictionaries", () => {
		const canonicals = new Set([
			...Object.keys(TIME_DICTIONARIES.en),
			...Object.keys(TIME_DICTIONARIES.fr),
		]);
		for (const canonical of canonicals) {
			expect(TIME_TO_MINUTES[canonical]).toBeDefined();
		}
	});
});

import { describe, it, expect } from "bun:test";
import { resolveTimeUnit } from "../src/time";

describe("resolveTimeUnit", () => {
	it("normalizes English time units", () => {
		expect(resolveTimeUnit("minutes")).toBe("m");
		expect(resolveTimeUnit("hours")).toBe("h");
		expect(resolveTimeUnit("seconds")).toBe("s");
	});

	it("normalizes French time units", () => {
		expect(resolveTimeUnit("heures", "fr")).toBe("h");
		expect(resolveTimeUnit("secondes", "fr")).toBe("s");
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

import { describe, it, expect } from "bun:test";
import { formatDuration, formatTimer, toCommonFraction } from "../src/index";

describe("formatDuration", () => {
	it("keeps whole durations readable", () => {
		expect(formatDuration(45)).toBe("45min");
		expect(formatDuration(60)).toBe("1h");
		expect(formatDuration(90)).toBe("1h 30min");
	});

	it("rounds to the minute from one hour up, never leaking a float", () => {
		expect(formatDuration(64.5)).toBe("1h 5min");
		expect(formatDuration(1439.4)).toBe("23h 59min");
		expect(formatDuration(59.995)).toBe("1h");
	});

	it("shows seconds below one hour", () => {
		expect(formatDuration(25.083333333333336)).toBe("25min 5s");
		expect(formatDuration(20 / 60)).toBe("20s");
	});

	it("counts in days and hours from a day up, without the minutes", () => {
		expect(formatDuration(1439.7)).toBe("1d");
		expect(formatDuration(1506)).toBe("1d 1h");
		expect(formatDuration(1497.58333)).toBe("1d 1h");
		expect(formatDuration(32 * 60)).toBe("1d 8h");
		expect(formatDuration(48 * 60 + 20)).toBe("2d");
	});

	it("keeps hours and minutes when told not to count in days", () => {
		expect(formatDuration(1506, "en", { days: false })).toBe("25h 6min");
		expect(formatDuration(1471, "fr", { days: false })).toBe("24h 31min");
	});

	it("speaks the display language", () => {
		expect(formatDuration(1506, "fr")).toBe("1j 1h");
		expect(formatDuration(90, "fr")).toBe("1h 30min");
		expect(formatDuration(0, "fr")).toBe("0min");
	});

	it("degrades to 0min on empty or invalid input", () => {
		expect(formatDuration(0)).toBe("0min");
		expect(formatDuration(Number.NaN)).toBe("0min");
		expect(formatDuration(-5)).toBe("0min");
	});
});

describe("formatTimer", () => {
	it("reads the unit from the token, not the quantity", () => {
		expect(formatTimer({ quantity: { value: 1, text: "1" }, unit: "h" })).toBe(
			"1h",
		);
		expect(
			formatTimer({ quantity: { value: 20, text: "20" }, unit: "s" }),
		).toBe("20s");
	});

	it("supports a separator and ranges", () => {
		expect(
			formatTimer(
				{ quantity: { type: "range", text: "10-15" }, unit: "min" },
				" ",
			),
		).toBe("10-15 min");
	});

	it("shows the bare value when there is no unit", () => {
		expect(formatTimer({ quantity: { value: 5, text: "5" } })).toBe("5");
	});
});

describe("toCommonFraction", () => {
	it("maps near-common fractions below 1", () => {
		expect(toCommonFraction(0.25)).toBe("1/4");
		expect(toCommonFraction(1 / 3)).toBe("1/3");
	});

	it("returns undefined otherwise", () => {
		expect(toCommonFraction(0.3)).toBeUndefined();
		expect(toCommonFraction(1.5)).toBeUndefined();
	});
});

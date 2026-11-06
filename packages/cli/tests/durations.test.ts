import { describe, expect, test } from "bun:test";
import { formatDurationDelta, formatElapsed } from "../src/ui/durations";

describe("formatDurationDelta (gram diff)", () => {
	test("signs the renderer's words", () => {
		expect(formatDurationDelta(90)).toBe("+1h 30m");
		expect(formatDurationDelta(-45)).toBe("-45m");
		expect(formatDurationDelta(120)).toBe("+2h");
		expect(formatDurationDelta(-0.5)).toBe("-30s");
	});

	test("no change is 0m, unsigned", () => {
		expect(formatDurationDelta(0)).toBe("0m");
	});
});

describe("formatElapsed (gram cook end screen)", () => {
	test("rounds to the minute, in the views' words", () => {
		expect(formatElapsed(90 * 60_000)).toBe("1h 30m");
		expect(formatElapsed(42 * 60_000 + 17_000)).toBe("42m");
		expect(formatElapsed(42 * 60_000 + 40_000)).toBe("43m");
	});

	test("keeps the seconds under a minute", () => {
		expect(formatElapsed(45_000)).toBe("45s");
		expect(formatElapsed(0)).toBe("0m");
	});
});

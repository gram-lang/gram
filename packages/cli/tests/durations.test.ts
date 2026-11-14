import { describe, expect, test } from "bun:test";
import { formatDurationDelta, formatElapsed } from "../src/ui/durations";

describe("formatDurationDelta (gram diff)", () => {
	test("signs the renderer's words", () => {
		expect(formatDurationDelta(90)).toBe("+1\u00A0h 30\u00A0min");
		expect(formatDurationDelta(-45)).toBe("-45\u00A0min");
		expect(formatDurationDelta(120)).toBe("+2\u00A0h");
		expect(formatDurationDelta(-0.5)).toBe("-30\u00A0s");
	});

	test("no change is 0 min, unsigned", () => {
		expect(formatDurationDelta(0)).toBe("0\u00A0min");
	});
});

describe("formatElapsed (gram cook end screen)", () => {
	test("rounds to the minute, in the views' words", () => {
		expect(formatElapsed(90 * 60_000)).toBe("1\u00A0h 30\u00A0min");
		expect(formatElapsed(42 * 60_000 + 17_000)).toBe("42\u00A0min");
		expect(formatElapsed(42 * 60_000 + 40_000)).toBe("43\u00A0min");
	});

	test("keeps the seconds under a minute", () => {
		expect(formatElapsed(45_000)).toBe("45\u00A0s");
		expect(formatElapsed(0)).toBe("0\u00A0min");
	});
});

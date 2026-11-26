import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src/index";

// The parser reads a decimal numerator as a fraction (`{1.5/2 cups}` is
// 0.75 cup, conformance case 025), but a timer's duration, read from its raw
// text by `parseDuration`, refused it with INVALID_DURATION and counted it
// for nothing. One answer for both now.
const compiled = (step: string) =>
	compile(getAST(`## S\n\nAdd @b{500 g}.\n\n${step}\n`));

/** The timer of the step, and how long the step is active. */
const timerOf = (step: string) => {
	const result = compiled(step);
	const second = result.sections[0]?.steps[1];
	return {
		codes: result.warnings.map((w) => w.code),
		minutes: (
			second?.content.find(
				(c) => typeof c === "object" && c.type === "timer",
			) as { minutes?: number } | undefined
		)?.minutes,
		active: second?.timings?.activeDuration,
	};
};

describe("a fraction with a decimal numerator in a timer", () => {
	it("is a duration, as it is a quantity for an ingredient", () => {
		for (const [step, minutes] of [
			["Bake for ~{1.5/2 min}.", 0.75],
			["Bake for ~{1,5/2 h}.", 45],
			["Bake for ~{1.0/5 min}.", 0.2],
		] as const) {
			const timer = timerOf(step);
			expect(timer.codes).not.toContain("INVALID_DURATION");
			expect(timer.minutes).toBeCloseTo(minutes);
			expect(timer.active).toBeCloseTo(minutes);
		}
	});

	it("is a duration in a proportional timer", () => {
		const timer = timerOf("Bake for ~{1.5/2 min / 500 g @&b}.");
		expect(timer.codes).not.toContain("INVALID_DURATION");
		expect(timer.minutes).toBeCloseTo(0.75);
		expect(timer.active).toBeCloseTo(0.75);
	});
});

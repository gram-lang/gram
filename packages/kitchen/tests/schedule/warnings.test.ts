import { describe, expect, it } from "bun:test";
import { isSameSchedulingProblem } from "../../src/schedule/build";
import { type Warning, WarningCode, pushWarning } from "../../src/warnings";

const loc = (offset: number) => ({ start: offset, end: offset + 10 });

function contention(trackName: string, delay: number, offset = 30): Warning {
	const warnings: Warning[] = [];
	pushWarning(warnings, WarningCode.TRACK_CONTENTION, {
		trackName,
		delay,
		item: "Step in section 'Bake'",
		loc: loc(offset),
	});
	return warnings[0]!;
}

function paradox(conflict: string, offset: number): Warning {
	const warnings: Warning[] = [];
	pushWarning(warnings, WarningCode.TIME_PARADOX, {
		cause: "Section 'Dough'",
		conflict,
		loc: loc(offset),
	});
	return warnings[0]!;
}

describe("isSameSchedulingProblem", () => {
	it("matches a contention whatever its delay", () => {
		expect(
			isSameSchedulingProblem(contention("oven", 15), contention("oven", 40)),
		).toBe(true);
		expect(
			isSameSchedulingProblem(contention("oven", 15), contention("oven", 0.5)),
		).toBe(true);
	});

	it("tells contentions on two tracks apart", () => {
		expect(
			isSameSchedulingProblem(contention("oven", 15), contention("oven2", 15)),
		).toBe(false);
	});

	it("matches a time paradox on its place in the source, not its message", () => {
		expect(
			isSameSchedulingProblem(paradox("T-10", 4), paradox("T-25", 4)),
		).toBe(true);
		expect(
			isSameSchedulingProblem(paradox("T-10", 4), paradox("T-10", 9)),
		).toBe(false);
	});

	it("never matches two different codes", () => {
		expect(
			isSameSchedulingProblem(contention("oven", 15), paradox("T-10", 3)),
		).toBe(false);
	});
});

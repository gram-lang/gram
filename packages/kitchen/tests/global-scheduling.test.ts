import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src/index";
import { WarningCode } from "../src/warnings";

describe("Global Scheduling and Retro-planning", () => {
	it("compiles a simple retro-planning gap with positive rebasing", () => {
		const source = `
## Dough ~{-1d}
[Mix] Flour and water.

## Bake
[Bake] In the oven for ~_{30min}.
`;
		const ast = getAST(source);
		const result = compile(ast);

		expect(result.warnings).toBeEmpty();

		const doughSection = result.sections[0];
		const bakeSection = result.sections[1];

		expect(doughSection.steps[0].timings.start).toBe(0);
		expect(doughSection.steps[0].timings.end).toBe(2); // default 2m active

		expect(bakeSection.steps[0].timings.start).toBe(1442); // 0m active, starts and ends at 1442
		expect(bakeSection.steps[0].timings.end).toBe(1442);

		expect(result.metrics.totalTime).toBe(1472); // because bake is 2 active, 30 passive, so workflow end is 1442 + 30 = 1472
	});

	it("respects inter-section dependencies with ALAP", () => {
		const source = `
## Starter ->&starter
[Make] the starter.

## Dough ->&dough
[Mix] with &starter.

[Rest] Let it rest ~_{2h}.

## Bake
[Bake] The &dough for ~_{30min}.
`;
		const ast = getAST(source);
		const result = compile(ast);

		expect(result.warnings).toBeEmpty();

		const starterStep = result.sections[0].steps[0];
		const mixStep = result.sections[1].steps[0];
		const restStep = result.sections[1].steps[1];
		const bakeStep = result.sections[2].steps[0];

		// Ensure timeline is monotonic
		expect(starterStep.timings.end).toBeLessThanOrEqual(mixStep.timings.start);

		// The passive task of restStep should finish EXACTLY when bakeStep starts
		expect(
			restStep.backgroundTasks![0].startOffset +
				restStep.backgroundTasks![0].duration +
				restStep.timings.start,
		).toBe(bakeStep.timings.start);
	});

	it("warns TIME_PARADOX when human anchor conflicts with dependency", () => {
		const source = `
## Sauce ~{-10min} ->&sauce
[Cook] the sauce.

## Meat ~{-60min}
[Cook] with &sauce.
`;
		const ast = getAST(source);
		const result = compile(ast);

		expect(result.warnings.length).toBe(1);
		expect(result.warnings[0].code).toBe(WarningCode.TIME_PARADOX);

		const sauceStep = result.sections[0].steps[0];
		const meatStep = result.sections[1].steps[0];

		expect(sauceStep.timings.end).toBeLessThanOrEqual(meatStep.timings.start);
	});

	it("warns TIME_PARADOX when two anchored sections conflict", () => {
		const source = `
## Starter ~{-1d} ->&starter
[Make] the starter.

## Dough ~{-2d}
[Mix] with &starter.
`;
		const ast = getAST(source);
		const result = compile(ast);

		expect(result.warnings.length).toBe(1);
		expect(result.warnings[0].code).toBe(WarningCode.TIME_PARADOX);

		const starterStep = result.sections[0].steps[0];
		const doughStep = result.sections[1].steps[0];

		expect(starterStep.timings.end).toBeLessThanOrEqual(
			doughStep.timings.start,
		);
	});

	it("section-level intermediate readiness accounts for non-last steps' passive tails", () => {
		// Regression test: the section's `->&name` product must not be considered
		// ready until every one of ITS OWN steps is actually done — not just the
		// textually last one. Here the long ferment is the FIRST step, followed
		// by a quick unrelated step; the ferment's 4h tail must still gate &levain.
		const source = `
## Levain ->&levain
[Ferment] Mix starter and let it ferment ~_{4h}.

[Check] Give it a quick stir.

## Bake
[Bake] Bake with &levain for ~_{30min}.
`;
		const ast = getAST(source);
		const result = compile(ast);

		expect(result.warnings).toBeEmpty();

		const fermentStep = result.sections[0].steps[0];
		const bakeStep = result.sections[1].steps[0];

		const fermentTaskEnd =
			fermentStep.timings.start +
			fermentStep.backgroundTasks![0].startOffset +
			fermentStep.backgroundTasks![0].duration;

		// &levain must be fully fermented no later than when Bake consumes it.
		expect(fermentTaskEnd).toBeLessThanOrEqual(bakeStep.timings.start);
	});

	it("warns TRACK_CONTENTION when named tracks collide due to retro-planning", () => {
		const source = `
## Cake A ~{-1d}
[Bake] In the ~_oven{30min}.

## Cake B ~{-1d}
[Bake] In the ~_oven{30min}.
`;
		const ast = getAST(source);
		const result = compile(ast);

		expect(result.warnings.length).toBe(1);
		expect(result.warnings[0].code).toBe(WarningCode.TRACK_CONTENTION);
	});

	// Regression tests for the audit (2026-07-22, finding F-002): default
	// chaining only looked at the *immediately* following section
	// (`stepsBySection[sIdx + 1]`), so a section with no steps of its own —
	// empty, or containing only a comment — left the chained start time at its
	// 0 default instead of reaching through to the next real section. The
	// step after the gap then overlapped whatever was still running before it.
	it("chains across an empty section instead of overlapping with it", () => {
		const source = `
## A

[a] Wait ~{60min}.

## Empty

## C

[c] Do it.
`;
		const ast = getAST(source);
		const result = compile(ast);

		const a = result.sections[0].steps[0];
		const c = result.sections[2].steps[0];

		expect(a.timings.start).toBe(0);
		expect(a.timings.end).toBe(60);
		// C must start no earlier than A ends — the bug scheduled it at 58,
		// overlapping the still-running 60min timer.
		expect(c.timings.start).toBeGreaterThanOrEqual(a.timings.end);
		expect(c.timings.start).toBe(60);
		expect(c.timings.end).toBe(62);
	});

	it("chains across a comment-only section the same way", () => {
		const source = `
## A

[a] Wait ~{60min}.

## Note
// just a comment, no steps

## C

[c] Do it.
`;
		const ast = getAST(source);
		const result = compile(ast);

		const a = result.sections[0].steps[0];
		const c = result.sections[2].steps[0];

		expect(a.timings.end).toBe(60);
		expect(c.timings.start).toBe(60);
	});

	it("reaches through multiple consecutive empty sections", () => {
		const source = `
## A

[a] Wait ~{60min}.

## Empty1

## Empty2

## C

[c] Do it.
`;
		const ast = getAST(source);
		const result = compile(ast);

		const a = result.sections[0].steps[0];
		const c = result.sections[3].steps[0];

		expect(a.timings.end).toBe(60);
		expect(c.timings.start).toBe(60);
	});
});

// Regression tests for the audit (2026-07-22, findings F-005/F-006): ~timer
// hand-normalized only "m"/"minutes" to "min" and left every other alias
// untouched, and a genuinely unrecognized unit fell through
// quantityToMinutes' d/h/m/s checks and was silently treated as plain
// minutes (e.g. "3 bananas" -> 3 minutes of active time, no warning).
describe("Timer unit normalization", () => {
	it("normalizes every alias of the same physical unit to the same display string", () => {
		const source = `
## Section

[a] Rest ~a{5 minutes}.

[b] Rest ~b{5 mins}.

[c] Rest ~c{2 heures}.

[d] Rest ~d{2 h}.
`;
		const ast = getAST(source);
		const result = compile(ast);

		const timers = result.sections[0].steps
			.map((s: any) => s.content.find((c: any) => c?.type === "timer"))
			.map((t: any) => t.unit);

		expect(timers).toEqual(["min", "min", "h", "h"]);
	});

	it("does not fabricate a duration for a timer with a genuinely unknown unit", () => {
		const source = `
## Section

[a] Wait ~{3 bananas}.
`;
		const ast = getAST(source);
		const result = compile(ast);

		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0].code).toBe(WarningCode.INVALID_UNIT);

		const step = result.sections[0].steps[0];
		expect(
			step.content.find((c: any) => c?.type === "timer").quantity,
		).toBeUndefined();
		// Only the baseline per-step overhead, not the fabricated "3 minutes".
		expect(step.timings.activeDuration).toBeLessThan(3);
	});

	it("does not fabricate a duration for a timer with a missing unit", () => {
		const source = `
## Section

[a] Wait ~{10}.
`;
		const ast = getAST(source);
		const result = compile(ast);

		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0].code).toBe(WarningCode.MISSING_UNIT);

		const step = result.sections[0].steps[0];
		expect(
			step.content.find((c: any) => c?.type === "timer").quantity,
		).toBeUndefined();
		expect(step.timings.activeDuration).toBeLessThan(10);
	});
});

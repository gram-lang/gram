import { describe, it, expect } from "bun:test";
import { scheduleALAP } from "../../src/schedule/alap";
import type { StepSchedule } from "../../src/schedule/types";
import type { ProcessedSection, ProcessedStep } from "../../src/types";
import { WarningCode, type Warning } from "../../src/warnings";

// These exercise the ALAP algorithm directly on synthetic StepSchedule
// arrays — no parser/compile() involved. Audit 2026-07-22, kitchen finding
// F-004/P-001: this is exactly the testability the schedule/ extraction was
// meant to unlock; every scheduling test that existed before this refactor
// had to go through getAST()+compile() to exercise this same code.

function makeStep(): ProcessedStep {
	return {
		type: "step",
		content: [],
		timings: { start: 0, end: 0, activeDuration: 0 },
		backgroundTasks: [],
	};
}

function makeSchedule(overrides: Partial<StepSchedule> = {}): StepSchedule {
	return {
		sectionIndex: 0,
		stepObj: makeStep(),
		isComment: false,
		localActiveTime: 2,
		productionTime: 2,
		produced: [],
		consumed: [],
		passiveTasks: [],
		ls: 0,
		lf: 0,
		...overrides,
	};
}

function makeSection(
	overrides: Partial<ProcessedSection> = {},
): ProcessedSection {
	return {
		title: null,
		ingredients: [],
		cookware: [],
		steps: [],
		...overrides,
	};
}

describe("scheduleALAP", () => {
	it("chains two single-step sections back to back, ending at the workflow end", () => {
		const a = makeSchedule({ sectionIndex: 0, localActiveTime: 10 });
		const b = makeSchedule({ sectionIndex: 1, localActiveTime: 5 });
		const sections = [makeSection(), makeSection()];

		scheduleALAP([a, b], sections, [], []);

		// b has nothing after it: lf = 0 (its own local default), ls = -5.
		expect(b.lf).toBe(0);
		expect(b.ls).toBe(-5);
		// a chains to b's start: lf = b.ls = -5, ls = -5 - 10 = -15.
		expect(a.lf).toBe(-5);
		expect(a.ls).toBe(-15);
	});

	it("anchors a section's end time via retro_planning instead of chaining", () => {
		const a = makeSchedule({ sectionIndex: 0, localActiveTime: 10 });
		const sections = [makeSection({ retro_planning: { minutes: -60 } })];

		scheduleALAP([a], sections, [], []);

		expect(a.lf).toBe(-60);
		expect(a.ls).toBe(-70);
	});

	it("constrains an earlier step's finish time via a produced/consumed dependency", () => {
		// The producer's section declares "starter"; a later, independent
		// schedule consumes it and must find it ready by the time it starts.
		const producer = makeSchedule({
			sectionIndex: 0,
			localActiveTime: 4,
			productionTime: 4,
			produced: ["starter"],
		});
		const consumer = makeSchedule({
			sectionIndex: 1,
			localActiveTime: 6,
			consumed: ["starter"],
		});
		const sections = [makeSection(), makeSection()];

		scheduleALAP([producer, consumer], sections, [], []);

		// consumer: lf=0, ls=-6 (nothing after it, no dependency of its own).
		expect(consumer.ls).toBe(-6);
		// producer must finish producing "starter" by consumer.ls (-6):
		// req(-6) - productionTime(4) + localActiveTime(4) = -6.
		expect(producer.lf).toBe(-6);
		expect(producer.ls).toBe(-10);
	});

	it("warns TIME_PARADOX when a section's retro_planning anchor conflicts with a downstream dependency on it", () => {
		const warnings: Warning[] = [];
		// Section 0 is anchored at T-5 and declares &starter. Section 1
		// consumes &starter but, given its own duration, needs it ready
		// earlier, at T-6 — one minute before section 0's anchor even allows
		// section 0 to finish. Physically impossible.
		const s0 = makeSchedule({ sectionIndex: 0, localActiveTime: 1 });
		const s1 = makeSchedule({
			sectionIndex: 1,
			consumed: ["starter"],
			localActiveTime: 6,
		});
		const sections = [
			makeSection({
				retro_planning: { minutes: -5 },
				intermediate_preparation: "starter",
			}),
			makeSection(),
		];

		scheduleALAP([s0, s1], sections, [], warnings);

		expect(warnings.some((w) => w.code === WarningCode.TIME_PARADOX)).toBe(
			true,
		);
	});

	it("chains two steps sharing a named track back-to-back, with no produced/consumed link", () => {
		// Two consecutive bakes in the same oven (`~_cuisson{...}`), exactly
		// like packages/docs/src/public/examples/canneles-fr.gram's Cuisson
		// section: neither step has active time of its own, and nothing
		// connects them via `produced`/`consumed` — only the shared track name.
		const first = makeSchedule({
			sectionIndex: 0,
			localActiveTime: 0,
			passiveTasks: [
				{ name: "cuisson", duration: 10, localOffset: 0, isNamed: true },
			],
		});
		const second = makeSchedule({
			sectionIndex: 0,
			localActiveTime: 0,
			passiveTasks: [
				{ name: "cuisson", duration: 30, localOffset: 0, isNamed: true },
			],
		});
		const sections = [makeSection()];

		scheduleALAP([first, second], sections, [], []);

		// second has nothing after it: ls = 0.
		expect(second.ls).toBe(0);
		// first's own "cuisson" window (ls + duration) must end by the time
		// second's starts (0), so first.ls is pushed back by second's duration
		// — not left tied with second at ls = 0, which is what would make
		// tracks.ts's serialization pass silently delay it and warn.
		expect(first.ls).toBe(-10);
	});

	it("skips a section with no steps without throwing", () => {
		const a = makeSchedule({ sectionIndex: 0 });
		const sections = [makeSection(), makeSection({ title: "Empty" })];

		expect(() => scheduleALAP([a], sections, [], [])).not.toThrow();
	});
});

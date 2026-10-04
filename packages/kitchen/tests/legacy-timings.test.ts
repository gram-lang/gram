import { describe, expect, it } from "bun:test";
import {
	computeTimeline,
	type ScheduledPassiveTask,
	type StepSchedule,
} from "@gram-lang/scheduler";
import { commitTimeline } from "../src/legacy-timings";
import type { ProcessedSection, ProcessedStep } from "../src/types";

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
		stepIndex: 0,
		isComment: false,
		localActiveTime: 0,
		productionTime: 0,
		produced: [],
		consumed: [],
		passiveTasks: [],
		ls: 0,
		lf: 0,
		...overrides,
	};
}

// A section holding one compiled step, the one `stepIndex: 0` points at.
function makeSection(
	overrides: Partial<ProcessedSection> = {},
): ProcessedSection {
	return {
		title: null,
		ingredients: [],
		cookware: [],
		steps: [makeStep()],
		...overrides,
	};
}

const stepOf = (sections: ProcessedSection[], i = 0) =>
	sections[i]!.steps[0] as ProcessedStep;

// Lays the schedules out, then writes the result onto the compiled steps: the
// two calls `compile()` makes for the default timeline.
const rebaseAndCommit = (
	schedules: StepSchedule[],
	passiveTasks: ScheduledPassiveTask[],
	sections: ProcessedSection[],
	globalActiveTime: number,
) =>
	commitTimeline(
		computeTimeline(schedules, passiveTasks, sections),
		sections,
		globalActiveTime,
	);

describe("commitTimeline", () => {
	it("shifts every timing so the earliest ls lands at zero", () => {
		const a = makeSchedule({ ls: -15, lf: -5, localActiveTime: 10 });
		const b = makeSchedule({
			sectionIndex: 1,
			ls: -5,
			lf: 0,
			localActiveTime: 5,
		});
		const sections = [makeSection(), makeSection()];

		rebaseAndCommit([a, b], [], sections, 15);

		expect(stepOf(sections, 0).timings).toEqual({
			start: 0,
			end: 10,
			activeDuration: 10,
		});
		expect(stepOf(sections, 1).timings).toEqual({
			start: 10,
			end: 15,
			activeDuration: 5,
		});
	});

	it("writes background tasks with a rebased startOffset relative to the step's own start", () => {
		const sched = makeSchedule({ ls: -10, lf: 0, localActiveTime: 10 });
		const passive: ScheduledPassiveTask = {
			sched,
			task: {
				name: "oven",
				sourceName: "oven",
				duration: 20,
				localOffset: 0,
				isNamed: true,
			},
			theoreticalStart: -10,
			actualStart: -10,
			actualEnd: 10,
		};
		const sections = [makeSection()];

		rebaseAndCommit([sched], [passive], sections, 10);

		expect(stepOf(sections).backgroundTasks[0]).toMatchObject({
			name: "oven",
			duration: 20,
			startOffset: 0, // task starts exactly when the step itself starts
		});
	});

	it("computes activeBreakdown grouped by section title", () => {
		const a = makeSchedule({ ls: -10, lf: 0, localActiveTime: 10 });

		const { activeBreakdown } = rebaseAndCommit(
			[a],
			[],
			[makeSection({ title: "Prep" })],
			10,
		);

		expect(activeBreakdown).toEqual([
			{ label: "section_active:Prep", duration: 10 },
		]);
	});

	it("computes idleTime as the gap between workflow duration and active time", () => {
		// A single 10-minute passive task with no active work at all: the
		// workflow takes 10 minutes total, none of it active -> 10 idle.
		const sched = makeSchedule({ ls: -10, lf: -10, localActiveTime: 0 });
		const passive: ScheduledPassiveTask = {
			sched,
			task: { name: "rest", duration: 10, localOffset: 0, isNamed: false },
			theoreticalStart: -10,
			actualStart: -10,
			actualEnd: 0,
		};

		const { idleTime, activeTime } = rebaseAndCommit(
			[sched],
			[passive],
			[makeSection()],
			0,
		);

		expect(activeTime).toBe(0);
		expect(idleTime).toBe(10);
	});

	it("ignores comment schedules when computing globalMinStart and breakdowns", () => {
		const comment = makeSchedule({ isComment: true, ls: -1000 });
		const step = makeSchedule({
			sectionIndex: 1,
			ls: -5,
			lf: 0,
			localActiveTime: 5,
		});
		const sections = [makeSection(), makeSection()];

		rebaseAndCommit([comment, step], [], sections, 5);

		// If the comment's ls (-1000) were considered, everything would be
		// shifted by 1000 instead of 5.
		expect(stepOf(sections, 1).timings.start).toBe(0);
		expect(stepOf(sections, 1).timings.end).toBe(5);
	});
});

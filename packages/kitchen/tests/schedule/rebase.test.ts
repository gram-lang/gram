import { describe, it, expect } from "bun:test";
import { rebaseAndCommit } from "../../src/schedule/rebase";
import type {
	ScheduledPassiveTask,
	StepSchedule,
} from "../../src/schedule/types";
import type { ProcessedSection, ProcessedStep } from "../../src/types";

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

describe("rebaseAndCommit", () => {
	it("shifts every timing so the earliest ls lands at zero", () => {
		const a = makeSchedule({ ls: -15, lf: -5, localActiveTime: 10 });
		const b = makeSchedule({
			sectionIndex: 1,
			ls: -5,
			lf: 0,
			localActiveTime: 5,
		});

		rebaseAndCommit([a, b], [], [makeSection(), makeSection()], 15);

		const aStep = a.stepObj as ProcessedStep;
		const bStep = b.stepObj as ProcessedStep;
		expect(aStep.timings.start).toBe(0);
		expect(aStep.timings.end).toBe(10);
		expect(bStep.timings.start).toBe(10);
		expect(bStep.timings.end).toBe(15);
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

		rebaseAndCommit([sched], [passive], [makeSection()], 10);

		const step = sched.stepObj as ProcessedStep;
		expect(step.backgroundTasks[0]).toMatchObject({
			name: "oven",
			duration: 20,
			startOffset: 0, // task starts exactly when the step itself starts
		});
	});

	it("computes activeBreakdown grouped by section title", () => {
		const a = makeSchedule({
			sectionIndex: 0,
			ls: -10,
			lf: 0,
			localActiveTime: 10,
		});

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
		const step = makeSchedule({ ls: -5, lf: 0, localActiveTime: 5 });

		rebaseAndCommit([comment, step], [], [makeSection(), makeSection()], 5);

		// If the comment's ls (-1000) were considered, everything would be
		// shifted by 1000 instead of 5.
		const stepObj = step.stepObj as ProcessedStep;
		expect(stepObj.timings.start).toBe(0);
		expect(stepObj.timings.end).toBe(5);
	});
});

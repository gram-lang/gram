import { describe, expect, it } from "bun:test";
import { computeTimeline } from "../src/rebase";
import type {
	ScheduledPassiveTask,
	SchedulingSection,
	StepSchedule,
} from "../src/types";

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

const section = (title: string | null = null): SchedulingSection => ({ title });

describe("computeTimeline", () => {
	it("shifts every timing so the earliest ls lands at zero", () => {
		const a = makeSchedule({ ls: -15, lf: -5, localActiveTime: 10 });
		const b = makeSchedule({
			sectionIndex: 1,
			ls: -5,
			lf: 0,
			localActiveTime: 5,
		});

		const { steps, blocks } = computeTimeline(
			[a, b],
			[],
			[section(), section()],
		);

		expect(steps.map((s) => [s.start, s.end])).toEqual([
			[0, 10],
			[10, 15],
		]);
		expect(blocks.map((b) => [b.kind, b.start, b.end])).toEqual([
			["step", 0, 10],
			["step", 10, 15],
		]);
	});

	it("points each block at the step index it was given", () => {
		const sched = makeSchedule({
			stepIndex: 3,
			ls: -4,
			lf: 0,
			localActiveTime: 4,
		});
		const { blocks } = computeTimeline([sched], [], [section()]);
		expect(blocks).toEqual([
			{ kind: "step", section: 0, step: 3, start: 0, end: 4 },
		]);
	});

	it("rebases passive tasks, keeping the track only for named ones", () => {
		const sched = makeSchedule({ ls: -10, lf: 0, localActiveTime: 10 });
		const named: ScheduledPassiveTask = {
			sched,
			task: { name: "oven", duration: 20, localOffset: 0, isNamed: true },
			theoreticalStart: -10,
			actualStart: -10,
			actualEnd: 10,
		};
		const anonymous: ScheduledPassiveTask = {
			sched,
			task: { name: "Timer", duration: 5, localOffset: 0, isNamed: false },
			theoreticalStart: -10,
			actualStart: -10,
			actualEnd: -5,
		};

		const { blocks } = computeTimeline(
			[sched],
			[named, anonymous],
			[section()],
		);

		const passives = blocks.filter((b) => b.kind === "passive");
		expect(passives).toEqual([
			{ kind: "passive", section: 0, step: 0, start: 0, end: 5 },
			{
				kind: "passive",
				section: 0,
				step: 0,
				start: 0,
				end: 20,
				track: "oven",
			},
		]);
	});

	it("computes activeBreakdown grouped by section title", () => {
		const a = makeSchedule({ ls: -10, lf: 0, localActiveTime: 10 });

		const { activeBreakdown } = computeTimeline([a], [], [section("Prep")]);

		expect(activeBreakdown).toEqual([
			{ label: "section_active:Prep", duration: 10 },
		]);
	});

	it("measures the workflow from the first start to the last end", () => {
		// A single 10-minute passive task with no active work at all.
		const sched = makeSchedule({ ls: -10, lf: -10, localActiveTime: 0 });
		const passive: ScheduledPassiveTask = {
			sched,
			task: { name: "rest", duration: 10, localOffset: 0, isNamed: false },
			theoreticalStart: -10,
			actualStart: -10,
			actualEnd: 0,
		};

		const { workflowDuration } = computeTimeline(
			[sched],
			[passive],
			[section()],
		);

		expect(workflowDuration).toBe(10);
	});

	it("ignores comment schedules when computing the shift and breakdowns", () => {
		const comment = makeSchedule({ isComment: true, ls: -1000 });
		const step = makeSchedule({ ls: -5, lf: 0, localActiveTime: 5 });

		const { steps } = computeTimeline([comment, step], [], [section()]);

		// If the comment's ls (-1000) were considered, everything would be
		// shifted by 1000 instead of 5.
		expect(steps.map((s) => [s.start, s.end])).toEqual([[0, 5]]);
	});
});

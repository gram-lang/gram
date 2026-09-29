import { describe, expect, it } from "bun:test";
import { buildUpfrontSchedule } from "../../src/schedule/build";
import { computeTimeline } from "../../src/schedule/rebase";
import type {
	ScheduledPassiveTask,
	StepSchedule,
} from "../../src/schedule/types";
import type {
	ProcessedSection,
	ProcessedStep,
	SectionMiseEnPlace,
} from "../../src/types";

function makeStep(): ProcessedStep {
	return {
		type: "step",
		content: [],
		timings: { start: 0, end: 0, activeDuration: 0 },
		backgroundTasks: [],
	};
}

function fixture() {
	const a: StepSchedule = {
		sectionIndex: 0,
		stepObj: makeStep(),
		isComment: false,
		localActiveTime: 5,
		productionTime: 5,
		produced: [],
		consumed: [],
		passiveTasks: [],
		ls: -20,
		lf: -15,
	};
	const b: StepSchedule = {
		sectionIndex: 1,
		stepObj: makeStep(),
		isComment: false,
		localActiveTime: 10,
		productionTime: 10,
		produced: [],
		consumed: [],
		passiveTasks: [],
		ls: -10,
		lf: 0,
	};
	const passive: ScheduledPassiveTask = {
		sched: a,
		task: { name: "oven", duration: 30, localOffset: 0, isNamed: true },
		theoreticalStart: -15,
		actualStart: -15,
		actualEnd: 15,
	};
	const sections: ProcessedSection[] = [a, b].map((s) => ({
		title: null,
		ingredients: [],
		cookware: [],
		steps: [s.stepObj as ProcessedStep],
	}));
	const mise: SectionMiseEnPlace[] = [
		{ section: 0, duration: 3, items: [] },
		{ section: 1, duration: 2, items: [] },
	];
	return { schedules: [a, b], passives: [passive], sections, mise };
}

describe("buildUpfrontSchedule", () => {
	it("lays the preparations end to end from T0", () => {
		const { schedules, passives, sections, mise } = fixture();
		const legacy = computeTimeline(schedules, passives, sections);
		const up = buildUpfrontSchedule(legacy, mise, 5, 15);

		const preps = up.blocks.filter((b) => b.kind === "prep");
		expect(preps).toEqual([
			{ kind: "prep", section: 0, start: 0, end: 3 },
			{ kind: "prep", section: 1, start: 3, end: 5 },
		]);
	});

	it("pushes every step and passive block back by the preparation time", () => {
		const { schedules, passives, sections, mise } = fixture();
		const legacy = computeTimeline(schedules, passives, sections);
		const up = buildUpfrontSchedule(legacy, mise, 5, 15);

		const shifted = up.blocks.filter((b) => b.kind !== "prep");
		expect(shifted).toHaveLength(legacy.blocks.length);
		for (const b of shifted) {
			const orig = legacy.blocks.find(
				(o) =>
					o.kind === b.kind &&
					o.section === b.section &&
					"step" in o &&
					"step" in b &&
					o.step === b.step,
			)!;
			expect(b.start).toBe(orig.start + 5);
			expect(b.end).toBe(orig.end + 5);
		}
	});

	it("adds the preparation to the legacy total, and keeps the track name", () => {
		const { schedules, passives, sections, mise } = fixture();
		const legacy = computeTimeline(schedules, passives, sections);
		const up = buildUpfrontSchedule(legacy, mise, 5, 15);

		expect(up.totalTime).toBe(legacy.workflowDuration + 5);
		expect(up.idleTime).toBe(up.totalTime - 15 - 5);
		const passive = up.blocks.find((b) => b.kind === "passive");
		expect(passive && "track" in passive && passive.track).toBe("oven");
	});

	it("leaves anonymous passive blocks without a track key", () => {
		const { schedules, passives, sections, mise } = fixture();
		passives[0]!.task.isNamed = false;
		const legacy = computeTimeline(schedules, passives, sections);
		const up = buildUpfrontSchedule(legacy, mise, 5, 15);
		const passive = up.blocks.find((b) => b.kind === "passive")!;
		expect("track" in passive).toBe(false);
	});
});

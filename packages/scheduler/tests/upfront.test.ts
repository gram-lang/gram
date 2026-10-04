import { describe, expect, it } from "bun:test";
import { buildSchedule } from "../src/build";
import type {
	MiseEnPlaceItem,
	SchedulingSection,
	SectionMiseEnPlace,
	StepSchedule,
} from "../src/types";

// One-minute gathers, so a section's mise en place lasts `count` minutes.
const gather = (count: number): MiseEnPlaceItem => ({
	kind: "gather",
	target: "ingredient",
	count,
	duration: count,
});

function fixture() {
	const a: StepSchedule = {
		sectionIndex: 0,
		stepIndex: 0,
		isComment: false,
		localActiveTime: 5,
		productionTime: 5,
		produced: [],
		consumed: [],
		passiveTasks: [
			{ name: "oven", duration: 30, localOffset: 0, isNamed: true },
		],
		ls: 0,
		lf: 0,
	};
	const b: StepSchedule = {
		sectionIndex: 1,
		stepIndex: 0,
		isComment: false,
		localActiveTime: 10,
		productionTime: 10,
		produced: [],
		consumed: [],
		passiveTasks: [],
		ls: 0,
		lf: 0,
	};
	const sections: SchedulingSection[] = [{ title: null }, { title: null }];
	const mise: SectionMiseEnPlace[] = [
		{ section: 0, duration: 3, items: [gather(3)] },
		{ section: 1, duration: 2, items: [gather(2)] },
	];
	return { schedules: [a, b], sections, mise };
}

describe('buildSchedule("upfront")', () => {
	it("lays the preparations end to end, right before the first step", () => {
		const { schedules, sections, mise } = fixture();
		const { schedule } = buildSchedule(
			"upfront",
			schedules,
			mise,
			sections,
			5,
			15,
		);

		const preps = schedule.blocks.filter((b) => b.kind === "prep");
		expect(preps).toEqual([
			{ kind: "prep", section: 0, start: 0, end: 3 },
			{ kind: "prep", section: 1, start: 3, end: 5 },
		]);
		const first = schedule.blocks.find((b) => b.kind === "step")!;
		expect(first.start).toBe(5);
	});

	it("reports total and idle time, and a single session", () => {
		const { schedules, sections, mise } = fixture();
		const { schedule } = buildSchedule(
			"upfront",
			schedules,
			mise,
			sections,
			5,
			15,
		);

		const maxEnd = Math.max(...schedule.blocks.map((b) => b.end));
		expect(schedule.totalTime).toBe(maxEnd);
		expect(schedule.idleTime).toBe(maxEnd - 15 - 5);
		expect(schedule.sessions).toEqual([
			{ day: 0, start: 0, end: 20, sections: [0, 1] },
		]);
	});

	it("keeps the track name of a named passive block", () => {
		const { schedules, sections, mise } = fixture();
		const { schedule } = buildSchedule(
			"upfront",
			schedules,
			mise,
			sections,
			5,
			15,
		);
		const passive = schedule.blocks.find((b) => b.kind === "passive");
		expect(passive && "track" in passive && passive.track).toBe("oven");
	});

	it("leaves anonymous passive blocks without a track key", () => {
		const { schedules, sections, mise } = fixture();
		schedules[0]!.passiveTasks[0]!.isNamed = false;
		const { schedule } = buildSchedule(
			"upfront",
			schedules,
			mise,
			sections,
			5,
			15,
		);
		const passive = schedule.blocks.find((b) => b.kind === "passive")!;
		expect("track" in passive).toBe(false);
	});
});

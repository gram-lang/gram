import { describe, expect, it } from "bun:test";
import { buildSchedule } from "../../src/schedule/build";
import type { StepSchedule } from "../../src/schedule/types";
import type {
	MiseEnPlaceItem,
	ProcessedSection,
	ProcessedStep,
	SectionMiseEnPlace,
} from "../../src/types";

// One-minute gathers, so a section's mise en place lasts `count` minutes.
const gather = (count: number): MiseEnPlaceItem => ({
	kind: "gather",
	target: "ingredient",
	count,
	duration: count,
});

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

// Section 0 makes a dough that rests 2h; section 1 needs a mise en place and
// then uses the dough.
function doughRecipe() {
	const rest = makeSchedule({
		localActiveTime: 2,
		productionTime: 122,
		produced: ["dough"],
		passiveTasks: [
			{ name: "Timer", duration: 120, localOffset: 2, isNamed: false },
		],
	});
	const assemble = makeSchedule({
		sectionIndex: 1,
		localActiveTime: 10,
		productionTime: 10,
		consumed: ["dough"],
	});
	const sections: ProcessedSection[] = [
		{
			title: "Dough",
			ingredients: [],
			cookware: [],
			steps: [rest.stepObj as ProcessedStep],
			intermediate_preparation: "dough",
		},
		{
			title: "Assembly",
			ingredients: [],
			cookware: [],
			steps: [assemble.stepObj as ProcessedStep],
		},
	];
	const mise: SectionMiseEnPlace[] = [
		{ section: 0, duration: 3, items: [gather(3)] },
		{ section: 1, duration: 8, items: [gather(8)] },
	];
	return { schedules: [rest, assemble], sections, mise };
}

describe('buildSchedule("perSection")', () => {
	it("places a section's preparation right before its first step, during an earlier rest", () => {
		const { schedules, sections, mise } = doughRecipe();
		const { schedule } = buildSchedule(
			"perSection",
			schedules,
			mise,
			sections,
			[],
			11,
			12,
		);

		const prep1 = schedule.blocks.find(
			(b) => b.kind === "prep" && b.section === 1,
		)!;
		const step1 = schedule.blocks.find(
			(b) => b.kind === "step" && b.section === 1,
		)!;
		const rest = schedule.blocks.find((b) => b.kind === "passive")!;

		expect(prep1.end).toBe(step1.start);
		expect(prep1.end - prep1.start).toBe(8);
		// The preparation happens while the dough is still resting.
		expect(prep1.start).toBeGreaterThanOrEqual(rest.start);
		expect(prep1.end).toBeLessThanOrEqual(rest.end);
	});

	it("starts with the first section's preparation at T0", () => {
		const { schedules, sections, mise } = doughRecipe();
		const { schedule } = buildSchedule(
			"perSection",
			schedules,
			mise,
			sections,
			[],
			11,
			12,
		);
		expect(schedule.blocks[0]).toEqual({
			kind: "prep",
			section: 0,
			start: 0,
			end: 3,
		});
	});

	it("reports total and idle time from the blocks", () => {
		const { schedules, sections, mise } = doughRecipe();
		const { schedule } = buildSchedule(
			"perSection",
			schedules,
			mise,
			sections,
			[],
			11,
			12,
		);
		const maxEnd = Math.max(...schedule.blocks.map((b) => b.end));
		expect(schedule.totalTime).toBe(maxEnd);
		expect(schedule.idleTime).toBe(maxEnd - 12 - 11);
	});

	it("never writes to the inputs (schedules, steps, produced)", () => {
		const { schedules, sections, mise } = doughRecipe();
		buildSchedule("perSection", schedules, mise, sections, [], 11, 12);

		for (const s of schedules) {
			expect(s.ls).toBe(0);
			expect(s.lf).toBe(0);
			expect((s.stepObj as ProcessedStep).timings.start).toBe(0);
			expect((s.stepObj as ProcessedStep).backgroundTasks).toEqual([]);
		}
		// scheduleALAP would push the section's product into every step's `produced`.
		expect(schedules[0]!.produced).toEqual(["dough"]);
		expect(schedules).toHaveLength(2);
	});

	it("keeps its warnings apart from the caller's", () => {
		const { schedules, sections, mise } = doughRecipe();
		const { warnings } = buildSchedule(
			"perSection",
			schedules,
			mise,
			sections,
			[],
			11,
			12,
		);
		expect(Array.isArray(warnings)).toBe(true);
	});

	it("emits no prep block for a section without mise en place", () => {
		const { schedules, sections } = doughRecipe();
		const { schedule } = buildSchedule(
			"perSection",
			schedules,
			[],
			sections,
			[],
			0,
			12,
		);
		expect(schedule.blocks.some((b) => b.kind === "prep")).toBe(false);
	});

	it("never overlaps a preparation with a step (one cook)", () => {
		const { schedules, sections, mise } = doughRecipe();
		const { schedule } = buildSchedule(
			"perSection",
			schedules,
			mise,
			sections,
			[],
			11,
			12,
		);
		const preps = schedule.blocks.filter((b) => b.kind === "prep");
		const steps = schedule.blocks.filter((b) => b.kind === "step");
		for (const p of preps) {
			for (const s of steps) {
				expect(p.start < s.end && s.start < p.end).toBe(false);
			}
		}
	});
});

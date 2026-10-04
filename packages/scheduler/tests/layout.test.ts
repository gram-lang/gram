import { describe, expect, it } from "bun:test";
import type {
	PrepTask,
	StepTask,
	TaskDuration,
	TaskGraph,
	TimerTask,
} from "../src/graph";
import { layout } from "../src/layout";
import type { MiseEnPlaceItem } from "../src/types";

// One-minute gathers, so a section's mise en place lasts `count` minutes.
const gather = (count: number, intermediates = 0): MiseEnPlaceItem => ({
	kind: "gather",
	target: "ingredient",
	count,
	duration: count,
	...(intermediates > 0 && { intermediates }),
});

const prep = (
	section: number,
	items: MiseEnPlaceItem[],
	extra: Partial<PrepTask> = {},
): PrepTask => ({
	id: `s${section}.prep${extra.intermediate ? `.${extra.intermediate}` : ""}`,
	kind: "prep",
	section,
	duration: { nominal: items.reduce((sum, i) => sum + i.duration, 0) },
	items,
	after: [],
	...extra,
});

const step = (
	section: number,
	index: number,
	minutes: number,
	extra: Partial<StepTask> = {},
): StepTask => ({
	id: `s${section}.${index}`,
	kind: "step",
	section,
	step: index,
	duration: { nominal: minutes },
	after: [],
	...extra,
});

const timer = (
	section: number,
	index: number,
	offset: number,
	duration: TaskDuration,
	track?: string,
): TimerTask => ({
	id: `s${section}.${index}.t0`,
	kind: "passive",
	section,
	step: index,
	...(track !== undefined && { track }),
	offset,
	duration,
	after: [`s${section}.${index}`],
});

// Section 0 makes a dough that rests 2h; section 1 needs a mise en place and
// then uses the dough.
const doughGraph = (): TaskGraph => ({
	tasks: [
		prep(0, [gather(3)]),
		step(0, 0, 2, { produces: ["dough"] }),
		timer(0, 0, 2, { nominal: 120 }),
		prep(1, [gather(8)]),
		step(1, 0, 10, { consumes: ["dough"], after: ["s0.0"] }),
	],
	sections: [{ day: 0, intermediate: "dough" }, { day: 0 }],
});

const blocksOf = (graph: TaskGraph, options = {}) =>
	layout(graph, options).schedule.blocks;

describe("layout (perSection)", () => {
	it("places a section's preparation right before its first step, during an earlier rest", () => {
		const blocks = blocksOf(doughGraph());
		const prep1 = blocks.find((b) => b.kind === "prep" && b.section === 1)!;
		const step1 = blocks.find((b) => b.kind === "step" && b.section === 1)!;
		const rest = blocks.find((b) => b.kind === "passive")!;

		expect(prep1.end).toBe(step1.start);
		expect(prep1.end - prep1.start).toBe(8);
		// The preparation happens while the dough is still resting.
		expect(prep1.start).toBeGreaterThanOrEqual(rest.start);
		expect(prep1.end).toBeLessThanOrEqual(rest.end);
	});

	it("starts with the first section's preparation at T0 and names the task of each block", () => {
		const blocks = blocksOf(doughGraph());
		expect(blocks[0]).toMatchObject({
			kind: "prep",
			task: "s0.prep",
			start: 0,
		});
		expect(blocks.map((b) => b.task).sort()).toEqual([
			"s0.0",
			"s0.0.t0",
			"s0.prep",
			"s1.0",
			"s1.prep",
		]);
	});

	it("describes itself and adds up: total = preparation + active + idle", () => {
		const { schedule } = layout(doughGraph());
		expect(schedule).toMatchObject({
			miseEnPlace: "perSection",
			rests: "shortest",
			preparationTime: 11,
			activeTime: 12,
		});
		const maxEnd = Math.max(...schedule.blocks.map((b) => b.end));
		expect(schedule.totalTime).toBe(maxEnd);
		expect(schedule.idleTime).toBe(maxEnd - 12 - 11);
	});

	it("never overlaps a preparation with a step (one cook)", () => {
		const { blocks } = layout(doughGraph()).schedule;
		const active = blocks.filter((b) => b.kind !== "passive");
		for (const a of active) {
			for (const b of active) {
				if (a !== b) expect(a.start < b.end && b.start < a.end).toBe(false);
			}
		}
	});

	it("emits no prep block for a section without mise en place", () => {
		const graph = doughGraph();
		graph.tasks = graph.tasks.filter((t) => t.kind !== "prep");
		const { schedule } = layout(graph);
		expect(schedule.blocks.some((b) => b.kind === "prep")).toBe(false);
		expect(schedule.preparationTime).toBe(0);
	});

	it("never modifies the graph it is given", () => {
		const graph = doughGraph();
		const before = JSON.stringify(graph);
		for (const miseEnPlace of [
			"perSection",
			"upfront",
			"perSession",
		] as const) {
			for (const rests of ["shortest", "balanced", "longest"] as const) {
				layout(graph, { miseEnPlace, rests });
			}
		}
		expect(JSON.stringify(graph)).toBe(before);
	});

	it("is deterministic", () => {
		expect(JSON.stringify(layout(doughGraph()))).toBe(
			JSON.stringify(layout(doughGraph())),
		);
	});

	it("keeps the track of a named passive block, and none on an anonymous one", () => {
		const graph: TaskGraph = {
			tasks: [
				step(0, 0, 5),
				timer(0, 0, 5, { nominal: 30 }, "oven"),
				step(1, 0, 10),
				timer(1, 0, 10, { nominal: 10 }),
			],
			sections: [{ day: 0 }, { day: 0 }],
		};
		const passives = blocksOf(graph).filter((b) => b.kind === "passive");
		expect(passives.find((b) => b.task === "s0.0.t0")).toHaveProperty(
			"track",
			"oven",
		);
		expect(passives.find((b) => b.task === "s1.0.t0")).not.toHaveProperty(
			"track",
		);
	});
});

describe("layout (upfront)", () => {
	const graph = (): TaskGraph => ({
		tasks: [
			prep(0, [gather(3)]),
			step(0, 0, 5),
			timer(0, 0, 0, { nominal: 30 }, "oven"),
			prep(1, [gather(2)]),
			step(1, 0, 10),
		],
		sections: [{ day: 0 }, { day: 0 }],
	});

	it("lays the preparations end to end, right before the first step", () => {
		const preps = blocksOf(graph(), { miseEnPlace: "upfront" }).filter(
			(b) => b.kind === "prep",
		);
		const firstStep = blocksOf(graph(), { miseEnPlace: "upfront" }).find(
			(b) => b.kind === "step",
		)!;
		expect(preps.map((b) => [b.section, b.start, b.end])).toEqual([
			[0, 0, 3],
			[1, 3, 5],
		]);
		expect(preps.at(-1)!.end).toBe(firstStep.start);
	});

	it("is a single session, with the same preparation and active time", () => {
		const upfront = layout(graph(), { miseEnPlace: "upfront" }).schedule;
		const perSection = layout(graph()).schedule;
		expect(upfront.sessions).toHaveLength(1);
		expect(upfront.preparationTime).toBe(perSection.preparationTime);
		expect(upfront.activeTime).toBe(perSection.activeTime);
	});
});

describe("layout and intermediates", () => {
	// Section 0 makes `&dough`; section 1 uses it and gathers it.
	const graph = (): TaskGraph => ({
		tasks: [
			prep(0, [gather(2)]),
			step(0, 0, 4, { produces: ["dough"] }),
			prep(1, [gather(1)]),
			prep(1, [gather(1, 1)], { intermediate: "dough", after: ["s0.0"] }),
			step(1, 0, 6, { consumes: ["dough"], after: ["s0.0"] }),
		],
		sections: [{ day: 0, intermediate: "dough" }, { day: 0 }],
	});

	it("plans an intermediate with its section, whole, in perSection", () => {
		const preps = blocksOf(graph()).filter((b) => b.kind === "prep");
		const one = preps.filter((b) => b.section === 1);
		expect(one).toHaveLength(1);
		expect(one[0]).not.toHaveProperty("items");
		expect(one[0]).not.toHaveProperty("deferred");
		expect(one[0]!.end - one[0]!.start).toBe(2);
	});

	it("waits for the intermediate to exist in upfront: its share goes right before its section", () => {
		const preps = blocksOf(graph(), { miseEnPlace: "upfront" }).filter(
			(b) => b.kind === "prep",
		);
		const later = preps.find((b) => b.section === 1 && "deferred" in b)!;
		const head = preps.find((b) => b.section === 1 && !("deferred" in b))!;
		const step1 = blocksOf(graph(), { miseEnPlace: "upfront" }).find(
			(b) => b.kind === "step" && b.section === 1,
		)!;
		expect(later).toMatchObject({
			deferred: true,
			task: "s1.prep.dough",
			items: [gather(1, 1)],
		});
		expect(later.end).toBe(step1.start);
		expect(head).toMatchObject({ task: "s1.prep", items: [gather(1)] });
		expect(head.end).toBeLessThanOrEqual(
			blocksOf(graph(), { miseEnPlace: "upfront" }).find(
				(b) => b.kind === "step" && b.section === 0,
			)!.start,
		);
	});

	it("gathers an intermediate made on an earlier day at the head of its own day (perSession)", () => {
		const g = graph();
		g.sections = [
			{ day: 1, deadline: 1440, intermediate: "dough" },
			{ day: 0 },
		];
		const preps = blocksOf(g, { miseEnPlace: "perSession" }).filter(
			(b) => b.kind === "prep" && b.section === 1,
		);
		expect(preps.some((b) => "deferred" in b)).toBe(false);
		const day0 = layout(g, {
			miseEnPlace: "perSession",
		}).schedule.sessions.find((s) => s.day === 0)!;
		expect(Math.min(...preps.map((b) => b.start))).toBe(day0.start);
	});

	it("keeps every item of a section across the blocks of a split", () => {
		const items = blocksOf(graph(), { miseEnPlace: "upfront" })
			.filter((b) => b.kind === "prep" && b.section === 1)
			.flatMap((b) => ("items" in b ? (b.items ?? []) : []));
		const count = items.reduce(
			(n, i) => n + (i.kind === "gather" ? i.count : 0),
			0,
		);
		expect(count).toBe(2);
	});
});

describe("layout and rests", () => {
	// A dough rests 12 to 24 h, then is baked.
	const graph = (): TaskGraph => ({
		tasks: [
			step(0, 0, 10, { produces: ["dough"] }),
			timer(0, 0, 10, { nominal: 720, min: 720, max: 1440 }),
			step(1, 0, 30, { consumes: ["dough"], after: ["s0.0"] }),
		],
		sections: [{ day: 0, intermediate: "dough" }, { day: 0 }],
	});
	const restOf = (rests: "shortest" | "balanced" | "longest") => {
		const b = layout(graph(), { rests }).schedule.blocks.find(
			(x) => x.kind === "passive",
		)!;
		return b.end - b.start;
	};

	it("lasts the shortest, the middle or the longest of a range", () => {
		expect(restOf("shortest")).toBe(720);
		expect(restOf("balanced")).toBe(1080);
		expect(restOf("longest")).toBe(1440);
	});

	it("stretches the whole timeline with the rest", () => {
		const total = (rests: "shortest" | "longest") =>
			layout(graph(), { rests }).schedule.totalTime;
		expect(total("longest") - total("shortest")).toBe(720);
	});

	it("is shortest by default and says which choice it made", () => {
		expect(layout(graph()).schedule.rests).toBe("shortest");
		expect(layout(graph(), { rests: "longest" }).schedule.rests).toBe(
			"longest",
		);
	});

	it("leaves an exact rest and an active timer alone", () => {
		const exact: TaskGraph = {
			tasks: [
				step(0, 0, 25, { produces: ["x"] }),
				timer(0, 0, 25, { nominal: 120 }),
				step(1, 0, 5, { consumes: ["x"] }),
			],
			sections: [{ day: 0, intermediate: "x" }, { day: 0 }],
		};
		const a = layout(exact, { rests: "shortest" }).schedule;
		const b = layout(exact, { rests: "longest" }).schedule;
		expect({ ...b, rests: "shortest" }).toEqual(a);
		// `nominal` is what an active range already planned on (its maximum).
		expect(a.activeTime).toBe(30);
	});
});

describe("layout diagnostics", () => {
	it("reports a session whose work would start before its 24 h window", () => {
		// `## Dough ~{-1d}` makes a dough that rests 50 h: the kneading is more
		// than the 2 days before the end that day 1 is meant to fit in.
		const graph: TaskGraph = {
			tasks: [
				step(0, 0, 10, { produces: ["dough"] }),
				timer(0, 0, 10, { nominal: 3000 }),
				step(1, 0, 30, { consumes: ["dough"], after: ["s0.0"] }),
			],
			sections: [{ day: 1, deadline: 1440, intermediate: "dough" }, { day: 0 }],
		};
		const { schedule, diagnostics } = layout(graph);
		const overflow = diagnostics.find((d) => d.code === "SESSION_OVERFLOW");
		const day1 = schedule.sessions.find((s) => s.day === 1)!;
		expect(overflow).toEqual({
			code: "SESSION_OVERFLOW",
			section: 0,
			day: 1,
			overflowMinutes: schedule.totalTime - 2 * 1440 - day1.start,
		});
		expect(overflow!.overflowMinutes! > 0).toBe(true);
	});

	it("reports nothing for a recipe that fits its days", () => {
		expect(layout(doughGraph()).diagnostics).toEqual([]);
	});

	it("reports a track contention as a structured diagnostic", () => {
		const graph: TaskGraph = {
			tasks: [
				step(0, 0, 1),
				timer(0, 0, 1, { nominal: 20 }, "oven"),
				step(1, 0, 1, { after: [] }),
				timer(1, 0, 1, { nominal: 10 }, "oven"),
			],
			sections: [{ day: 0 }, { day: 0 }],
		};
		// Two ovens in a row never contend (ALAP chains them): no diagnostic.
		expect(
			layout(graph).diagnostics.filter((d) => d.code === "TRACK_CONTENTION"),
		).toEqual([]);
	});
});

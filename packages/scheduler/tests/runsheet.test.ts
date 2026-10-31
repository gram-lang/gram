import { describe, expect, it } from "bun:test";
import type { TaskGraph } from "../src/graph";
import { project } from "../src/project";
import { layout } from "../src/layout";
import { MISE_EN_PLACE_MODES } from "../src/mode";
import { PASSAGE_GAP_MINUTES, runSheet } from "../src/runsheet";
import canneles from "./fixtures/canneles-graph.json";

const graph: TaskGraph = {
	tasks: [
		{
			id: "s0.0",
			kind: "step",
			section: 0,
			step: 0,
			duration: { nominal: 20 },
			produces: ["dough"],
			after: [],
		},
		{
			id: "s0.0.t0",
			kind: "passive",
			section: 0,
			step: 0,
			track: "fridge",
			offset: 20,
			duration: { nominal: 480, min: 480, max: 960 },
			after: ["s0.0"],
		},
		{
			id: "s1.0",
			kind: "step",
			section: 1,
			step: 0,
			duration: { nominal: 30 },
			consumes: ["dough"],
			after: ["s0.0"],
		},
	],
	sections: [{ day: 1, intermediate: "dough" }, { day: 0 }],
};

const plan = project([{ graph, title: "Bread" }], {
	serveAt: "2026-10-11T13:00",
	timeZone: "Europe/Paris",
	availability: { daily: [{ start: "08:00", end: "22:00" }] },
});
const sheet = runSheet(plan);

describe("runSheet", () => {
	it("groups the tasks by calendar day, furthest first, with the days before the service", () => {
		const [recipe] = sheet.recipes;
		expect(recipe!.title).toBe("Bread");
		expect(recipe!.days.map((d) => [d.date, d.daysBefore])).toEqual([
			["2026-10-10", 1],
			["2026-10-11", 0],
		]);
	});

	it("lists each day's tasks in the order they happen", () => {
		const [saturday, sunday] = sheet.recipes[0]!.days;
		expect(saturday!.entries.map((e) => e.task)).toEqual(["s0.0", "s0.0.t0"]);
		expect(sunday!.entries.map((e) => e.task)).toEqual(["s1.0"]);
	});

	it("says whether the cook is busy, and keeps the track of a timer", () => {
		const [saturday] = sheet.recipes[0]!.days;
		const [knead, rest] = saturday!.entries;
		expect(knead).toMatchObject({ kind: "step", active: true, minutes: 20 });
		expect(rest).toMatchObject({
			kind: "passive",
			active: false,
			track: "fridge",
		});
	});

	it("keeps the exact minute: rounding is for the renderer", () => {
		const [saturday] = sheet.recipes[0]!.days;
		expect(saturday!.entries[0]!.startLocal).toBe("2026-10-10T21:40");
	});

	it("explains a rest the plan stretched, on the rest itself", () => {
		const [saturday] = sheet.recipes[0]!.days;
		expect(saturday!.entries[1]!.adjustment).toEqual({
			task: "s0.0.t0",
			from: 480,
			to: 870,
			reason: "avoid-unavailable",
		});
		expect(saturday!.entries[0]!.adjustment).toBeUndefined();
	});

	it("carries what could not be fixed", () => {
		const bad = runSheet(
			project(
				[
					{
						graph: {
							...graph,
							tasks: graph.tasks.map((t) =>
								t.kind === "passive" ? { ...t, duration: { nominal: 480 } } : t,
							),
						},
					},
				],
				{
					serveAt: "2026-10-11T13:00",
					timeZone: "Europe/Paris",
					availability: { daily: [{ start: "08:00", end: "22:00" }] },
				},
			),
		);
		expect(bad.diagnostics.map((d) => d.code)).toContain(
			"ACTIVE_OUTSIDE_AVAILABILITY",
		);
	});

	it("has no day for no work", () => {
		expect(
			runSheet(
				project([], {
					serveAt: "2026-10-11T13:00",
					timeZone: "UTC",
					availability: { daily: [] },
				}),
			).recipes,
		).toEqual([]);
	});
});

// Three working days: a base two days before, an insert the day before, and
// two moments in the kitchen on the day itself, with a 90 min wait between.
const entremets: TaskGraph = {
	tasks: [
		{
			id: "s0.0",
			kind: "step",
			section: 0,
			step: 0,
			duration: { nominal: 30 },
			produces: ["a"],
			after: [],
		},
		{
			id: "s0.0.t0",
			kind: "passive",
			section: 0,
			step: 0,
			offset: 30,
			duration: { nominal: 1400, min: 1400, max: 2880 },
			after: ["s0.0"],
		},
		{
			id: "s1.0",
			kind: "step",
			section: 1,
			step: 0,
			duration: { nominal: 40 },
			consumes: ["a"],
			produces: ["b"],
			after: ["s0.0"],
		},
		{
			id: "s1.0.t0",
			kind: "passive",
			section: 1,
			step: 0,
			offset: 40,
			duration: { nominal: 1300, min: 1300, max: 2880 },
			after: ["s1.0"],
		},
		{
			id: "s2.0",
			kind: "step",
			section: 2,
			step: 0,
			duration: { nominal: 15 },
			consumes: ["b"],
			produces: ["c"],
			after: ["s1.0"],
		},
		{
			id: "s2.0.t0",
			kind: "passive",
			section: 2,
			step: 0,
			offset: 15,
			duration: { nominal: 90 },
			after: ["s2.0"],
		},
		{
			id: "s3.0",
			kind: "step",
			section: 3,
			step: 0,
			duration: { nominal: 15 },
			consumes: ["c"],
			after: ["s2.0"],
		},
	],
	sections: [
		{ day: 2, intermediate: "a" },
		{ day: 1, intermediate: "b" },
		{ day: 0, intermediate: "c" },
		{ day: 0 },
	],
};

const entremetsPlan = project([{ graph: entremets, title: "Entremets" }], {
	serveAt: "2026-10-17T20:00",
	timeZone: "Europe/Paris",
	availability: { daily: [{ start: "00:00", end: "23:59" }] },
});

describe("runSheet days, passages and threads", () => {
	it("opens a day per working day, with the passages of the kitchen", () => {
		const [recipe] = runSheet(entremetsPlan, { graph: entremets }).recipes;
		expect(recipe!.days.map((d) => d.daysBefore)).toEqual([2, 1, 0]);
		expect(recipe!.days.map((d) => d.passages.length)).toEqual([1, 1, 2]);
		const [, , last] = recipe!.days;
		expect(last!.passages.map((p) => p.sections)).toEqual([[2], [3]]);
		expect(last!.passages[0]!.end - last!.passages[0]!.start).toBe(15);
	});

	it("gives dates and local times on the calendar", () => {
		const { days } = runSheet(entremetsPlan).recipes[0]!;
		expect(days.map((d) => d.date)).toEqual([
			"2026-10-15",
			"2026-10-16",
			"2026-10-17",
		]);
		expect(days[2]!.passages[1]!.endLocal).toBe("2026-10-17T20:00");
	});

	it("counts the minutes from the service and the cook's own work only", () => {
		const sheet = runSheet(entremetsPlan);
		const last = sheet.recipes[0]!.days[2]!;
		expect(last.passages[1]).toMatchObject({ start: -15, end: 0 });
		expect(sheet.recipes[0]!.totalWork).toBe(30 + 40 + 15 + 15);
	});

	it("tells what goes on without the cook after a passage, with the written range", () => {
		const { days } = runSheet(entremetsPlan, { graph: entremets }).recipes[0]!;
		expect(days[1]!.threads).toEqual([
			expect.objectContaining({
				passage: 0,
				task: "s1.0.t0",
				section: 1,
				planned: 1300,
				range: { min: 1300, max: 2880 },
			}),
		]);
		// An exact wait has no range to show.
		expect(days[2]!.threads[0]!.range).toBeUndefined();
	});

	it("splits a day at a wait of an hour or more and not before", () => {
		expect(PASSAGE_GAP_MINUTES).toBe(60);
		const short: TaskGraph = {
			...entremets,
			tasks: entremets.tasks.map((t) =>
				t.id === "s2.0.t0" ? { ...t, duration: { nominal: 45 } } : t,
			),
		};
		const day = runSheet(layout(short).schedule).recipes[0]!.days[2]!;
		expect(day.passages).toHaveLength(1);
		expect(day.passages[0]!.sections).toEqual([2, 3]);
		// A wait inside a passage is not a thread.
		expect(day.threads).toEqual([]);
	});

	it("keeps a passage that crosses midnight whole, on the date it starts", () => {
		const night: TaskGraph = {
			tasks: [
				{
					id: "s0.0",
					kind: "step",
					section: 0,
					step: 0,
					duration: { nominal: 40 },
					after: [],
				},
			],
			sections: [{ day: 0 }],
		};
		const plan = project([{ graph: night }], {
			serveAt: "2026-10-11T00:10",
			timeZone: "Europe/Paris",
			availability: { daily: [{ start: "20:00", end: "02:00" }] },
		});
		const [day] = runSheet(plan).recipes[0]!.days;
		expect(day!.date).toBe("2026-10-10");
		expect(day!.passages).toHaveLength(1);
		expect(day!.passages[0]).toMatchObject({
			startLocal: "2026-10-10T23:30",
			endLocal: "2026-10-11T00:10",
		});
	});

	it("has nothing to show for a recipe with no task", () => {
		const empty = layout({ tasks: [], sections: [] }).schedule;
		expect(runSheet(empty).recipes[0]).toEqual({
			days: [],
			miseEnPlace: "perSection",
			totalWork: 0,
		});
	});

	it("works without a serving time: no date, a service at zero", () => {
		const sheet = runSheet(layout(entremets).schedule, { title: "Entremets" });
		expect(sheet).toMatchObject({ mode: "relative", adjustments: [] });
		expect(sheet.serveAt).toBeUndefined();
		const { days, title } = sheet.recipes[0]!;
		expect(title).toBe("Entremets");
		expect(days.map((d) => d.date)).toEqual([undefined, undefined, undefined]);
		expect(days.map((d) => d.passages.length)).toEqual([1, 1, 2]);
		expect(days[2]!.passages[1]!.end).toBe(0);
		expect(days[0]!.passages[0]!.startLocal).toBeUndefined();
	});

	it("tells the same days with and without a serving time", () => {
		const shape = (s: ReturnType<typeof runSheet>) =>
			s.recipes[0]!.days.map((d) => ({
				daysBefore: d.daysBefore,
				passages: d.passages.map((p) => [p.start, p.end, p.sections]),
			}));
		// The plan moved nothing here: same days, same minutes from the service.
		expect(shape(runSheet(entremetsPlan))).toEqual(
			shape(runSheet(layout(entremets).schedule)),
		);
	});

	for (const mode of MISE_EN_PLACE_MODES) {
		it(`covers every task of the schedule once in ${mode} mode`, () => {
			const graph = canneles as unknown as TaskGraph;
			const { schedule } = layout(graph, { miseEnPlace: mode });
			const sheet = runSheet(schedule);
			const { days, totalWork } = sheet.recipes[0]!;
			const tasks = days.flatMap((d) => d.passages.flatMap((p) => p.tasks));
			const active = schedule.blocks
				.filter((b) => b.kind !== "passive")
				.map((b) => b.task);
			expect([...tasks].sort()).toEqual([...active].sort());
			expect(totalWork).toBeCloseTo(
				schedule.activeTime + schedule.preparationTime,
			);
			for (const d of days) {
				for (const t of d.threads) {
					const home = d.passages[t.passage]!;
					expect(t.to).toBeGreaterThan(home.end);
				}
			}
		});
	}

	it("tells a single working day that runs over several dates one day per date", () => {
		const upfront = runSheet(
			project([{ graph, options: { miseEnPlace: "upfront" } }], {
				serveAt: "2026-10-11T13:00",
				timeZone: "Europe/Paris",
				availability: { daily: [{ start: "08:00", end: "22:00" }] },
			}),
		);
		const { days } = upfront.recipes[0]!;
		expect(days.map((d) => [d.date, d.daysBefore])).toEqual([
			["2026-10-10", 1],
			["2026-10-11", 0],
		]);
		// The wait that starts on the first date belongs to it.
		expect(days[0]!.threads.map((t) => t.task)).toEqual(["s0.0.t0"]);
	});

	it("places an adjustment on its section and day", () => {
		const { adjustments } = runSheet(plan, { graph });
		expect(adjustments).toEqual([
			{
				task: "s0.0.t0",
				from: 480,
				to: 870,
				reason: "avoid-unavailable",
				section: 0,
				step: 0,
				track: "fridge",
				day: 1,
			},
		]);
	});
});

describe("runSheet mise en place mode", () => {
	const ctx = {
		serveAt: "2026-10-11T13:00",
		timeZone: "Europe/Paris",
		availability: { daily: [{ start: "08:00", end: "22:00" }] },
	};

	it("carries the mode of the plan, the default included", () => {
		expect(runSheet(project([{ graph }], ctx)).recipes[0]?.miseEnPlace).toBe(
			"perSection",
		);
		for (const miseEnPlace of MISE_EN_PLACE_MODES) {
			const projected = project([{ graph, options: { miseEnPlace } }], ctx);
			expect(runSheet(projected).recipes[0]?.miseEnPlace).toBe(miseEnPlace);
		}
	});

	it("carries the mode of a bare schedule", () => {
		for (const miseEnPlace of MISE_EN_PLACE_MODES) {
			expect(
				runSheet(layout(graph, { miseEnPlace }).schedule).recipes[0]
					?.miseEnPlace,
			).toBe(miseEnPlace);
		}
		expect(runSheet(layout(graph).schedule).recipes[0]?.miseEnPlace).toBe(
			"perSection",
		);
	});
});

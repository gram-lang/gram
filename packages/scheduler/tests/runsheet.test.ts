import { describe, expect, it } from "bun:test";
import type { TaskGraph } from "../src/graph";
import { project } from "../src/project";
import { runSheet } from "../src/runsheet";

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

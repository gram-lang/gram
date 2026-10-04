import { describe, expect, it } from "bun:test";
import type {
	PrepTask,
	StepTask,
	TaskDuration,
	TaskGraph,
	TimerTask,
} from "../src/graph";
import { layout } from "../src/layout";
import { project } from "../src/project";
import type { Availability, ProjectionContext } from "../src/projection";

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

// Kneading for 20 minutes, a rest, then 30 minutes of baking.
const doughGraph = (
	rest: TaskDuration,
	days: [number, number] = [0, 0],
): TaskGraph => ({
	tasks: [
		step(0, 0, 20, { produces: ["dough"] }),
		timer(0, 0, 20, rest),
		step(1, 0, 30, { consumes: ["dough"], after: ["s0.0"] }),
	],
	sections: [{ day: days[0], intermediate: "dough" }, { day: days[1] }],
});

const DAYTIME: Availability = { daily: [{ start: "08:00", end: "22:00" }] };
const context = (
	patch: Partial<ProjectionContext> = {},
): ProjectionContext => ({
	serveAt: "2026-10-11T13:00",
	timeZone: "Europe/Paris",
	availability: DAYTIME,
	...patch,
});

const blockOf = (plan: ReturnType<typeof project>, task: string) =>
	plan.recipes[0]!.blocks.find((b) => b.task === task)!;

describe("project without any constraint", () => {
	const always: Availability = { daily: [{ start: "00:00", end: "24:00" }] };

	it("is the layout, ending when it is served", () => {
		const graph = doughGraph({ nominal: 480, min: 480, max: 960 });
		const plan = project([{ graph }], context({ availability: always }));
		const { schedule } = layout(graph);
		expect(plan.adjustments).toEqual([]);
		expect(plan.diagnostics).toEqual([]);
		const last = plan.recipes[0]!.blocks.at(-1)!;
		expect(last.endLocal).toBe("2026-10-11T13:00");
		expect(plan.recipes[0]!.blocks).toHaveLength(schedule.blocks.length);
		expect(blockOf(plan, "s0.0").startLocal).toBe("2026-10-11T04:10");
	});

	it("gives every block an instant in UTC and one on the wall clock", () => {
		const plan = project(
			[{ graph: doughGraph({ nominal: 60 }) }],
			context({ availability: always }),
		);
		const bake = blockOf(plan, "s1.0");
		expect(bake.end).toBe("2026-10-11T11:00:00Z");
		expect(bake.endLocal).toBe("2026-10-11T13:00");
	});

	it("keeps the title and says nothing of the unavailable", () => {
		const plan = project(
			[{ graph: doughGraph({ nominal: 60 }), title: "Bread" }],
			context({ availability: always }),
		);
		expect(plan.recipes[0]!.title).toBe("Bread");
		expect(plan.unavailable).toEqual([]);
	});
});

describe("project and the night", () => {
	it("stretches a rest so the kneading falls the evening before", () => {
		// Shortest rest: kneading at 04:10. Stretched: it ends at 22:00 on Saturday.
		const graph = doughGraph({ nominal: 480, min: 480, max: 960 }, [1, 0]);
		const plan = project([{ graph }], context());
		expect(plan.diagnostics).toEqual([]);
		expect(plan.adjustments).toEqual([
			{ task: "s0.0.t0", from: 480, to: 870, reason: "avoid-unavailable" },
		]);
		expect(blockOf(plan, "s0.0").startLocal).toBe("2026-10-10T21:40");
		expect(blockOf(plan, "s0.0").endLocal).toBe("2026-10-10T22:00");
		expect(blockOf(plan, "s1.0").startLocal).toBe("2026-10-11T12:30");
	});

	it("never stretches a rest past its range, and says what it could not fix", () => {
		const graph = doughGraph({ nominal: 480, min: 480, max: 600 });
		const plan = project([{ graph }], context());
		expect(plan.adjustments).toEqual([]);
		expect(plan.diagnostics).toContainEqual({
			code: "ACTIVE_OUTSIDE_AVAILABILITY",
			task: "s0.0",
			local: "2026-10-11T04:10",
			rest: "s0.0.t0",
		});
	});

	it("leaves an exact rest alone and names the rest that holds the work in place", () => {
		const plan = project([{ graph: doughGraph({ nominal: 480 }) }], context());
		expect(plan.adjustments).toEqual([]);
		expect(plan.diagnostics).toEqual([
			{
				code: "ACTIVE_OUTSIDE_AVAILABILITY",
				task: "s0.0",
				local: "2026-10-11T04:10",
				rest: "s0.0.t0",
			},
		]);
	});

	it("shrinks a rest instead when the longest is asked for and stretching is not possible", () => {
		// The longest rest (16 h) puts the kneading at 03:10; it cannot grow, so it
		// shrinks until the kneading is at 08:00.
		const graph = doughGraph({ nominal: 480, min: 480, max: 960 });
		const plan = project(
			[{ graph, options: { rests: "longest" } }],
			context({ serveAt: "2026-10-11T20:00" }),
		);
		expect(plan.diagnostics).toEqual([]);
		expect(plan.adjustments).toEqual([
			{ task: "s0.0.t0", from: 960, to: 670, reason: "avoid-unavailable" },
		]);
		expect(blockOf(plan, "s0.0").startLocal).toBe("2026-10-11T08:00");
	});

	it("prefers the shorter rest when it is asked for, and shrinks before it stretches", () => {
		// Same recipe served at 20:00, rests: shortest (8 h): kneading at 11:10,
		// available: nothing to do.
		const graph = doughGraph({ nominal: 480, min: 480, max: 960 });
		const plan = project([{ graph }], context({ serveAt: "2026-10-11T20:00" }));
		expect(plan.adjustments).toEqual([]);
	});

	it("does not touch the work of a recipe that already fits", () => {
		const graph = doughGraph({ nominal: 480, min: 480, max: 960 });
		const plan = project([{ graph }], context({ serveAt: "2026-10-11T22:00" }));
		expect(plan.adjustments).toEqual([]);
		expect(plan.diagnostics).toEqual([]);
	});

	it("greys out when the cook is not available, within the plan", () => {
		const graph = doughGraph({ nominal: 480, min: 480, max: 960 });
		const plan = project([{ graph }], context());
		expect(plan.unavailable[0]).toEqual({
			start: "2026-10-10T20:00:00Z",
			end: "2026-10-11T06:00:00Z",
		});
	});
});

describe("project and work that cannot be interrupted", () => {
	it("flags a stretch of work longer than any availability, and does not try to fix it", () => {
		const graph: TaskGraph = {
			tasks: [step(0, 0, 180)],
			sections: [{ day: 0 }],
		};
		const plan = project(
			[{ graph }],
			context({ availability: { daily: [{ start: "18:00", end: "20:00" }] } }),
		);
		expect(plan.diagnostics).toContainEqual({
			code: "ACTIVE_BLOCK_EXCEEDS_AVAILABILITY",
			tasks: ["s0.0"],
			minutes: 180,
			largest: 120,
		});
		expect(
			plan.diagnostics.some((d) => d.code === "ACTIVE_OUTSIDE_AVAILABILITY"),
		).toBe(false);
	});

	it("joins a preparation to the step it precedes: together they must fit", () => {
		const prep: PrepTask = {
			id: "s0.prep",
			kind: "prep",
			section: 0,
			duration: { nominal: 70 },
			items: [
				{ kind: "gather", target: "ingredient", count: 70, duration: 70 },
			],
			after: [],
		};
		const graph: TaskGraph = {
			tasks: [prep, step(0, 0, 60)],
			sections: [{ day: 0 }],
		};
		const plan = project(
			[{ graph }],
			context({ availability: { daily: [{ start: "12:00", end: "14:00" }] } }),
		);
		// 130 minutes of work in a 120-minute availability.
		expect(plan.diagnostics).toContainEqual({
			code: "ACTIVE_BLOCK_EXCEEDS_AVAILABILITY",
			tasks: ["s0.prep", "s0.0"],
			minutes: 130,
			largest: 120,
		});
	});
});

describe("project and the calendar", () => {
	it("counts a day of 25 hours for what it lasts", () => {
		// The clocks go back on 2026-10-25. A rest of exactly 24 h before 12:30 that
		// Sunday started at 13:30 on Saturday on the wall clock.
		const graph = doughGraph({ nominal: 1440 });
		const plan = project(
			[{ graph }],
			context({
				serveAt: "2026-10-25T13:00",
				availability: { daily: [{ start: "00:00", end: "24:00" }] },
			}),
		);
		expect(blockOf(plan, "s0.0.t0").startLocal).toBe("2026-10-24T13:30");
		expect(blockOf(plan, "s0.0.t0").endLocal).toBe("2026-10-25T12:30");
		expect(
			(Date.parse(blockOf(plan, "s0.0.t0").end) -
				Date.parse(blockOf(plan, "s0.0.t0").start)) /
				60000,
		).toBe(1440);
	});

	it("serves in the zone it is given", () => {
		const graph = doughGraph({ nominal: 60 });
		const plan = project(
			[{ graph }],
			context({
				timeZone: "America/New_York",
				availability: { daily: [{ start: "00:00", end: "24:00" }] },
			}),
		);
		expect(blockOf(plan, "s1.0").end).toBe("2026-10-11T17:00:00Z");
	});

	it("reads availability by weekday and by date, the date first", () => {
		// Served on Monday. Sunday is not available at all: the kneading goes to
		// Saturday, at the end of the day, however long the rest has to be.
		const graph = doughGraph({ nominal: 480, min: 480, max: 2400 }, [2, 0]);
		const plan = project(
			[{ graph }],
			context({
				serveAt: "2026-10-12T13:00",
				availability: { ...DAYTIME, dates: { "2026-10-11": [] } },
			}),
		);
		expect(plan.diagnostics).toEqual([]);
		expect(blockOf(plan, "s0.0").endLocal).toBe("2026-10-10T22:00");
		expect(plan.adjustments[0]).toMatchObject({ from: 480, to: 2310 });
	});

	it("lets a date that is available win over a weekday that is not", () => {
		const graph: TaskGraph = {
			tasks: [step(0, 0, 30)],
			sections: [{ day: 0 }],
		};
		const plan = project(
			[{ graph }],
			context({
				availability: {
					daily: [],
					weekdays: { sun: [] },
					dates: { "2026-10-11": [{ start: "12:00", end: "14:00" }] },
				},
			}),
		);
		expect(plan.diagnostics).toEqual([]);
	});

	it("reads a range that ends before it starts as running past midnight", () => {
		const graph: TaskGraph = {
			tasks: [step(0, 0, 30)],
			sections: [{ day: 0 }],
		};
		const plan = project(
			[{ graph }],
			context({
				serveAt: "2026-10-11T00:30",
				availability: { daily: [{ start: "22:00", end: "02:00" }] },
			}),
		);
		expect(plan.diagnostics).toEqual([]);
	});
});

describe("project and the days of a recipe", () => {
	const twoDays = (): TaskGraph => ({
		tasks: [step(0, 0, 30), step(1, 0, 30)],
		sections: [{ day: 1, deadline: 1440 }, { day: 0 }],
	});

	it("says when a working day falls on another date than the one it is for", () => {
		// Nothing keeps the first day off the day itself here: both steps fall on
		// Sunday, the first one is for Saturday.
		const graph: TaskGraph = {
			tasks: [step(0, 0, 30), step(1, 0, 30)],
			sections: [{ day: 1 }, { day: 0 }],
		};
		const plan = project(
			[{ graph }],
			context({ availability: { daily: [{ start: "00:00", end: "24:00" }] } }),
		);
		expect(plan.diagnostics).toContainEqual({
			code: "SESSION_DAY_MISMATCH",
			day: 1,
			expected: "2026-10-10",
			actual: "2026-10-11",
		});
	});

	it("has nothing to say when the days fall where they should", () => {
		const plan = project(
			[{ graph: twoDays() }],
			context({ availability: { daily: [{ start: "00:00", end: "24:00" }] } }),
		);
		expect(
			plan.diagnostics.filter((d) => d.code === "SESSION_DAY_MISMATCH"),
		).toEqual([]);
	});
});

describe("project and the present", () => {
	const graph = doughGraph({ nominal: 480 });
	const always: Availability = { daily: [{ start: "00:00", end: "24:00" }] };

	it("warns when the work should already have begun", () => {
		const plan = project(
			[{ graph }],
			context({ availability: always, now: "2026-10-11T09:00" }),
		);
		expect(plan.diagnostics).toContainEqual({
			code: "START_IN_PAST",
			start: "2026-10-11T02:10:00Z",
			now: "2026-10-11T07:00:00Z",
		});
	});

	it("reads the present as an instant when it carries an offset", () => {
		const plan = project(
			[{ graph }],
			context({ availability: always, now: "2026-10-11T09:00:00+02:00" }),
		);
		expect(plan.diagnostics.some((d) => d.code === "START_IN_PAST")).toBe(true);
	});

	it("checks nothing against the clock without it", () => {
		const plan = project([{ graph }], context({ availability: always }));
		expect(plan.diagnostics.some((d) => d.code === "START_IN_PAST")).toBe(
			false,
		);
	});
});

describe("project and several recipes", () => {
	it("plans the first and says it did not plan the others", () => {
		const graph = doughGraph({ nominal: 60 });
		const plan = project(
			[
				{ graph, title: "A" },
				{ graph, title: "B" },
			],
			context({ availability: { daily: [{ start: "00:00", end: "24:00" }] } }),
		);
		expect(plan.recipes.map((r) => r.title)).toEqual(["A"]);
		expect(plan.diagnostics).toContainEqual({
			code: "MULTI_RECIPE_UNSUPPORTED",
			recipes: 2,
		});
	});

	it("plans nothing for nothing", () => {
		expect(project([], context()).recipes).toEqual([]);
	});
});

describe("project and bad input", () => {
	it("refuses a time zone that does not exist", () => {
		expect(() =>
			project(
				[{ graph: doughGraph({ nominal: 1 }) }],
				context({ timeZone: "Mars/Olympus" }),
			),
		).toThrow(RangeError);
	});

	it("refuses a serving time that is not a local date-time", () => {
		expect(() =>
			project(
				[{ graph: doughGraph({ nominal: 1 }) }],
				context({ serveAt: "next sunday" }),
			),
		).toThrow(RangeError);
	});
});

describe("project is a function of its input", () => {
	it("never modifies the graph or the context", () => {
		const graph = doughGraph({ nominal: 480, min: 480, max: 960 });
		const ctx = context();
		const before = JSON.stringify([graph, ctx]);
		project([{ graph }], ctx);
		expect(JSON.stringify([graph, ctx])).toBe(before);
	});

	it("gives the same plan twice", () => {
		const graph = doughGraph({ nominal: 480, min: 480, max: 960 });
		expect(JSON.stringify(project([{ graph }], context()))).toBe(
			JSON.stringify(project([{ graph }], context())),
		);
	});
});

import { describe, expect, it } from "bun:test";
import type { Task, TaskGraph } from "../src/graph";
import type { ProjectionContext } from "../src/projection";
import { project } from "../src/project";
import { runSheet } from "../src/runsheet";
import { WINDOW_MIN_MINUTES } from "../src/windows";

const context = (over: Partial<ProjectionContext> = {}): ProjectionContext => ({
	serveAt: "2026-10-17T20:00",
	timeZone: "Europe/Paris",
	availability: { daily: [{ start: "08:00", end: "23:00" }] },
	...over,
});

const sheetOf = (graph: TaskGraph, ctx: ProjectionContext) =>
	runSheet(project([{ graph }], ctx), { graph, context: ctx });

const visitsOf = (sheet: ReturnType<typeof runSheet>) =>
	sheet.recipes[0]!.days.flatMap((d) => d.visits);

// A base two days before, an insert the day before, then two visits on the
// day, with an exact 90 min wait between.
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

describe("visit windows", () => {
	it("tells how early a visit could happen, up to when the cook is available", () => {
		const [first] = visitsOf(sheetOf(entremets, context()));
		expect(first!.window).toMatchObject({
			advance: 710,
			earliestLocal: "2026-10-15T08:00",
		});
	});

	it("never goes before the present", () => {
		const [first] = visitsOf(
			sheetOf(entremets, context({ now: "2026-10-15T17:50" })),
		);
		expect(first!.window).toMatchObject({
			advance: 120,
			earliestLocal: "2026-10-15T17:50",
		});
	});

	it("gives no margin when the wait before it cannot get shorter", () => {
		const [, second] = visitsOf(sheetOf(entremets, context()));
		expect(second!.window).toBeUndefined();
		expect(second!.fixedBy).toBeUndefined();
	});

	it("names the exact wait that holds a visit before the next one", () => {
		const visits = visitsOf(sheetOf(entremets, context()));
		expect(visits[2]!.fixedBy).toMatchObject({
			task: "s2.0.t0",
			planned: 90,
			before: "visit",
			sections: [3],
		});
	});

	it("holds a visit before the service by its exact wait", () => {
		const graph: TaskGraph = {
			tasks: [
				{
					id: "s0.0",
					kind: "step",
					section: 0,
					step: 0,
					duration: { nominal: 20 },
					after: [],
				},
				{
					id: "s0.0.t0",
					kind: "passive",
					section: 0,
					step: 0,
					offset: 20,
					duration: { nominal: 120 },
					after: ["s0.0"],
				},
			],
			sections: [{ day: 0 }],
		};
		const [only] = visitsOf(sheetOf(graph, context()));
		expect(only!.fixedBy).toMatchObject({ before: "service", planned: 120 });
	});

	it("keeps a stretchable wait from holding anything, within what it allows", () => {
		const graph: TaskGraph = {
			tasks: [
				{
					id: "s0.0",
					kind: "step",
					section: 0,
					step: 0,
					duration: { nominal: 20 },
					after: [],
				},
				{
					id: "s0.0.t0",
					kind: "passive",
					section: 0,
					step: 0,
					offset: 20,
					duration: { nominal: 120, min: 120, max: 150 },
					after: ["s0.0"],
				},
			],
			sections: [{ day: 0 }],
		};
		// 30 min of stretch: the visit may start that much earlier, no more.
		const [only] = visitsOf(sheetOf(graph, context()));
		expect(only!.window!.advance).toBe(30);
	});

	it("does not hold a visit by a wait that ends in the middle of nothing", () => {
		// The rest ends hours before anything needs it: it moves with its start.
		const graph: TaskGraph = {
			tasks: [
				{
					id: "s0.0",
					kind: "step",
					section: 0,
					step: 0,
					duration: { nominal: 20 },
					produces: ["a"],
					after: [],
				},
				{
					id: "s0.0.t0",
					kind: "passive",
					section: 0,
					step: 0,
					offset: 20,
					duration: { nominal: 30 },
					after: ["s0.0"],
				},
				{
					id: "s1.0",
					kind: "step",
					section: 1,
					step: 0,
					duration: { nominal: 15 },
					consumes: ["a"],
					produces: ["b"],
					after: ["s0.0"],
				},
				{
					id: "s1.0.t0",
					kind: "passive",
					section: 1,
					step: 0,
					offset: 15,
					duration: { nominal: 600, min: 600, max: 1500 },
					after: ["s1.0"],
				},
				{
					id: "s2.0",
					kind: "step",
					section: 2,
					step: 0,
					duration: { nominal: 10 },
					consumes: ["b"],
					after: ["s1.0"],
				},
			],
			sections: [
				{ day: 1, intermediate: "a" },
				{ day: 1, intermediate: "b" },
				{ day: 0 },
			],
		};
		const visits = visitsOf(sheetOf(graph, context()));
		for (const p of visits) {
			expect(p.fixedBy?.before).not.toBe("service");
		}
		expect(visits[0]!.window).toBeDefined();
	});

	it("leaves the sheet alone without the graph or the context", () => {
		const plan = project([{ graph: entremets }], context());
		for (const sheet of [
			runSheet(plan),
			runSheet(plan, { graph: entremets }),
		]) {
			for (const p of visitsOf(sheet)) {
				expect(p.window).toBeUndefined();
				expect(p.fixedBy).toBeUndefined();
			}
		}
	});

	it("keeps a margin shorter than the threshold out", () => {
		expect(WINDOW_MIN_MINUTES).toBe(15);
		const graph: TaskGraph = {
			tasks: [
				{
					id: "s0.0",
					kind: "step",
					section: 0,
					step: 0,
					duration: { nominal: 20 },
					after: [],
				},
				{
					id: "s0.0.t0",
					kind: "passive",
					section: 0,
					step: 0,
					offset: 20,
					duration: { nominal: 120, min: 120, max: 130 },
					after: ["s0.0"],
				},
			],
			sections: [{ day: 0 }],
		};
		const [only] = visitsOf(sheetOf(graph, context()));
		expect(only!.window).toBeUndefined();
	});
});

// A small seeded generator: the same graphs on every run.
function rng(seed: number) {
	let s = seed;
	return () => {
		s = (s * 1664525 + 1013904223) % 4294967296;
		return s / 4294967296;
	};
}

function generate(random: () => number): TaskGraph {
	const sections = 2 + Math.floor(random() * 3);
	const tasks: Task[] = [];
	const meta: TaskGraph["sections"] = [];
	for (let i = 0; i < sections; i++) {
		const last = i === sections - 1;
		const minutes = 10 + Math.floor(random() * 50);
		tasks.push({
			id: `s${i}.0`,
			kind: "step",
			section: i,
			step: 0,
			duration: { nominal: minutes },
			...(i > 0 && { consumes: [`i${i - 1}`] }),
			...(!last && { produces: [`i${i}`] }),
			after: i > 0 ? [`s${i - 1}.0`] : [],
		});
		if (!last || random() < 0.5) {
			const min = 30 + Math.floor(random() * 600);
			const exact = random() < 0.3;
			const max = exact ? min : min + Math.floor(random() * 900);
			tasks.push({
				id: `s${i}.0.t0`,
				kind: "passive",
				section: i,
				step: 0,
				offset: minutes,
				...(random() < 0.3 && { track: "fridge" }),
				duration: exact ? { nominal: min } : { nominal: min, min, max },
				after: [`s${i}.0`],
			});
		}
		meta.push({
			day: sections - 1 - i,
			...(!last && { intermediate: `i${i}` }),
		});
	}
	return { tasks, sections: meta };
}

describe("visit windows (property)", () => {
	it("moving any visits by up to their margin breaks no wait and no order", () => {
		const random = rng(42);
		let withWindow = 0;
		for (let n = 0; n < 60; n++) {
			const graph = generate(random);
			const ctx = context({
				serveAt: `2026-10-${10 + Math.floor(random() * 15)}T${12 + Math.floor(random() * 9)}:00`,
				availability: { daily: [{ start: "07:00", end: "23:00" }] },
			});
			const sheet = runSheet(project([{ graph }], ctx), {
				graph,
				context: ctx,
			});
			const recipe = sheet.recipes[0]!;
			const visits = recipe.days.flatMap((d) => d.visits);
			const waits = recipe.days.flatMap((d) =>
				d.entries.filter((e) => e.kind === "passive"),
			);
			const ranges = new Map(
				graph.tasks.flatMap((t) =>
					t.kind === "passive"
						? [
								[
									t.id,
									{
										min: t.duration.min ?? t.duration.nominal,
										max: t.duration.max ?? t.duration.nominal,
									},
								] as const,
							]
						: [],
				),
			);
			// Each visit moves a random share of its margin, or not at all.
			const shift = visits.map((p) => {
				if (!p.window) return 0;
				withWindow++;
				return random() < 0.3 ? 0 : p.window.advance * random();
			});
			const startsIn = (from: number) => {
				let k = 0;
				visits.forEach((p, i) => {
					if (p.start <= from + 1e-6) k = i;
				});
				return k;
			};
			const visitAt = (at: number) =>
				visits.findIndex((p) => p.start - 1e-6 <= at && at <= p.end + 1e-6);
			const startOf = new Map(
				recipe.days.flatMap((d) =>
					d.entries
						.filter((e) => e.kind !== "passive")
						.map((e) => [e.task, e.from] as const),
				),
			);
			// A wait is needed by the first task that depends on its step, else
			// by the service: the written range bounds the span up to then.
			const neededAt = (w: (typeof waits)[number]) => {
				const parent = graph.tasks.find((t) => t.id === w.task)?.after[0];
				let at = Infinity;
				for (const t of graph.tasks) {
					if (t.kind === "passive" || !parent || !t.after.includes(parent))
						continue;
					const f = startOf.get(t.id);
					if (f !== undefined) at = Math.min(at, f);
				}
				return Number.isFinite(at) ? Math.max(at, w.to) : 0;
			};
			for (const w of waits) {
				const need = neededAt(w);
				const s = startsIn(w.from);
				const e = visitAt(need);
				const before = need - w.from;
				const after = before + shift[s]! - (e === -1 ? 0 : shift[e]!);
				const range = ranges.get(w.task)!;
				const planned = w.to - w.from;
				const written = range.min < range.max;
				// Never made worse than it was, and inside the range when it was. An
				// exact wait is a minimum, and a ceiling only where it is tight.
				const max = written
					? range.max
					: before > planned + 1e-6
						? Infinity
						: planned;
				const min = written ? range.min : planned;
				expect(after <= max + 1e-6 || after <= before + 1e-6).toBe(true);
				expect(after >= min - 1e-6 || after >= before - 1e-6).toBe(true);
			}
			visits.forEach((p, i) => {
				if (i === 0) return;
				const before = visits[i - 1]!;
				expect(p.start - shift[i]!).toBeGreaterThanOrEqual(
					before.end - shift[i - 1]! - 1e-6,
				);
			});
		}
		// Not vacuous: the generator does give margins.
		expect(withWindow).toBeGreaterThan(10);
	});
});

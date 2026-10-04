import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { layout } from "@gram-lang/scheduler";
import {
	compile,
	type ProcessedSection,
	type StepTask,
	WarningCode,
} from "../src/index";
import { sectionDays } from "../src/task-graph";

const build = (source: string) => compile(getAST(source));
const idsOf = (source: string) => build(source).tasks.tasks.map((t) => t.id);

const DOUGH = `## Dough ->&dough

Mix @flour{500g} with @water{300ml}, then knead ~{10min}.

Let it rest ~_{12-24h}.

## Bake

Bake &dough{800g} ~{20-25min}.
`;

describe("task ids", () => {
	it("are stable and readable", () => {
		expect(idsOf(DOUGH)).toEqual([
			"s0.prep",
			"s0.0",
			"s0.1",
			"s0.1.t0",
			"s1.prep.dough",
			"s1.0",
		]);
	});

	it("name the preparation of an intermediate after the section and the intermediate", () => {
		// Section 1 gathers nothing but the dough: no preparation of its own.
		expect(idsOf(DOUGH).filter((id) => id.startsWith("s1.prep"))).toEqual([
			"s1.prep.dough",
		]);
	});

	it("are unique", () => {
		const ids = idsOf(DOUGH);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

describe("durations", () => {
	const tasks = build(DOUGH).tasks.tasks;
	const byId = (id: string) => tasks.find((t) => t.id === id)!;

	it("give a passive range its shortest figure as nominal, and keep both ends", () => {
		expect(byId("s0.1.t0").duration).toEqual({
			nominal: 720,
			min: 720,
			max: 1440,
		});
	});

	it("give an active range its longest figure and no ends: cooking is uncertain, not elastic", () => {
		const bake = byId("s1.0") as StepTask;
		expect(bake.duration).toEqual({ nominal: 25 });
	});

	it("keep an exact timer exact", () => {
		const exact = build("## A\n\nBake ~{30min}.\n\nRest ~_{2h}.\n").tasks.tasks;
		expect(exact.find((t) => t.kind === "step")!.duration).toEqual({
			nominal: 30,
		});
		expect(exact.find((t) => t.kind === "passive")!.duration).toEqual({
			nominal: 120,
		});
	});

	it("start a timer after the active work that comes before it in its step", () => {
		const [timer] = build(
			"## A\n\nKnead ~{10min}, rest ~_{1h}.\n",
		).tasks.tasks.filter((t) => t.kind === "passive");
		expect(timer).toMatchObject({ offset: 10 });
	});

	it("leave the deprecated fields on the average of a range, as in 1.3.0", () => {
		const result = build(DOUGH);
		const [, rest, bake] = [
			...result.sections[0]!.steps,
			...result.sections[1]!.steps,
		];
		expect(rest).toMatchObject({
			backgroundTasks: [{ duration: (720 + 1440) / 2 }],
		});
		expect(bake).toMatchObject({ timings: { activeDuration: 22.5 } });
		expect(result.metrics.activeTime).toBe(10 + 22.5);
		// ...while the timeline plans on the figures of the graph.
		expect(result.schedule.activeTime).toBe(10 + 25);
	});

	it("give a step with no time of its own the default two minutes", () => {
		const [step] = build("## A\n\nStir @salt{1g}.\n").tasks.tasks.filter(
			(t) => t.kind === "step",
		);
		expect(step!.duration).toEqual({ nominal: 2 });
	});
});

describe("what a task waits for", () => {
	const tasks = build(DOUGH).tasks.tasks;
	const after = (id: string) => tasks.find((t) => t.id === id)!.after;

	it("lists the previous step of its section", () => {
		expect(after("s0.1")).toEqual(["s0.0"]);
		expect(after("s0.0")).toEqual([]);
	});

	it("lists the step that makes the intermediate a step uses", () => {
		expect(after("s1.0")).toEqual(["s0.1"]);
	});

	it("lists the step that makes an intermediate for its preparation", () => {
		expect(after("s1.prep.dough")).toEqual(["s0.1"]);
	});

	it("lists the step a timer belongs to", () => {
		expect(after("s0.1.t0")).toEqual(["s0.1"]);
	});

	it("keeps the list, empty, in the JSON", () => {
		const serialized = JSON.parse(JSON.stringify(build(DOUGH).tasks));
		for (const t of serialized.tasks) expect(Array.isArray(t.after)).toBe(true);
	});
});

describe("a compiled recipe without work", () => {
	it("has an empty graph and a timeline of zero", () => {
		const result = build("");
		expect(result.tasks).toEqual({ tasks: [], sections: [] });
		expect(result.schedule).toMatchObject({
			miseEnPlace: "perSection",
			rests: "shortest",
			totalTime: 0,
			activeTime: 0,
			preparationTime: 0,
			idleTime: 0,
			blocks: [],
			sessions: [],
		});
	});
});

describe("the default timeline", () => {
	it("is the default layout of the graph", () => {
		const result = build(DOUGH);
		expect(result.schedule).toEqual(layout(result.tasks).schedule);
	});

	it("takes the shortest rests", () => {
		const result = build(DOUGH);
		const rest = result.schedule.blocks.find((b) => b.kind === "passive")!;
		expect(rest.end - rest.start).toBe(720);
	});
});

const section = (
	rp?: { unit: "d" | "h" | "min"; minutes: number } | null,
): ProcessedSection => ({
	title: null,
	ingredients: [],
	cookware: [],
	steps: [],
	...(rp && { retro_planning: { raw: "", ...rp } }),
});
const days = (...rps: Parameters<typeof section>[]) =>
	sectionDays(rps.map((rp) => section(...rp)));
const d = (n: number) => ({ unit: "d" as const, minutes: -n * 1440 });
const h = (n: number) => ({ unit: "h" as const, minutes: -n * 60 });

describe("the working day of a section", () => {
	it("is the day of its own anchor in days", () => {
		expect(days([d(3)], [d(1)], [h(1)])).toEqual([3, 1, 0]);
	});

	it("is, without an anchor, the day of the furthest anchor in days after it", () => {
		expect(days([d(2)], [], [d(1)])).toEqual([2, 1, 1]);
		// The example of the plan: a crust, a filling with no anchor, a tart.
		expect(days([d(3)], [], [d(1)])).toEqual([3, 1, 1]);
	});

	it("is day 0 after the last anchor", () => {
		expect(days([d(1)], [], [])).toEqual([1, 0, 0]);
	});

	it("takes the furthest day when anchors are out of order", () => {
		expect(days([d(1)], [d(2)], [])).toEqual([2, 2, 0]);
	});

	it("is never opened by an anchor in hours or minutes, however far back", () => {
		expect(days([h(36)], [h(48)], [{ unit: "min", minutes: -3000 }])).toEqual([
			0, 0, 0,
		]);
	});

	it("keeps an anchor in hours inside the day of the next anchor in days", () => {
		expect(days([h(30)], [d(1)])).toEqual([1, 1]);
	});

	it("reads the absolute value of the anchor", () => {
		expect(days([{ unit: "d", minutes: 2880 }])).toEqual([2]);
	});

	it("ignores an anchor with no minutes", () => {
		const bad = section();
		bad.retro_planning = { raw: "~{-?d}", unit: "d" };
		expect(sectionDays([bad, section(d(1))])).toEqual([1, 1]);
	});
});

describe("SESSION_OVERFLOW", () => {
	const OVERFLOWING =
		"## Dough ~{-1d} ->&dough\n\nMix @flour{500g}.\n\nFerment ~_{50h}.\n\n## Bake\n\nBake &dough{500g} ~{30min}.\n";

	it("warns when a long rest pushes a day out of its 24 h window", () => {
		const warning = build(OVERFLOWING).warnings.find(
			(w) => w.code === WarningCode.SESSION_OVERFLOW,
		);
		expect(warning).toMatchObject({ section: "Dough" });
		expect(warning!.message).toContain("Working day 1");
	});

	it("is raised once, with the location of the section", () => {
		const warnings = build(OVERFLOWING).warnings.filter(
			(w) => w.code === WarningCode.SESSION_OVERFLOW,
		);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]!.loc).toBeDefined();
	});

	it("does not warn when the rest fits the day", () => {
		const fits =
			"## Dough ~{-1d} ->&dough\n\nMix @flour{500g}.\n\nFerment ~_{10h}.\n\n## Bake\n\nBake &dough{500g} ~{30min}.\n";
		expect(
			build(fits).warnings.some((w) => w.code === WarningCode.SESSION_OVERFLOW),
		).toBe(false);
	});

	it("reads a section anchored in hours past 24 h as part of the day itself", () => {
		const hours =
			"## Marinade ~{-36h}\n\nMix @chicken{1kg}, rest ~_{36h}.\n\n## Cook\n\nFry ~{20min}.\n";
		const result = build(hours);
		expect(result.schedule.sessions).toHaveLength(1);
		expect(
			result.warnings.some((w) => w.code === WarningCode.SESSION_OVERFLOW),
		).toBe(true);
	});
});

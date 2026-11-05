import { describe, expect, it } from "bun:test";
import type { TaskGraph } from "../src/graph";
import type { ProjectionContext } from "../src/projection";
import {
	DEFAULT_MEAL_TIMES,
	earliestServe,
	findServeTimes,
	tryServeAt,
} from "../src/serve";

const context = (over: Partial<ProjectionContext> = {}): ProjectionContext => ({
	serveAt: "2026-10-12T20:00",
	timeZone: "Europe/Paris",
	availability: { daily: [{ start: "08:00", end: "22:00" }] },
	now: "2026-10-10T10:00",
	...over,
});

// 20 min of work, an exact 2 h wait, 15 min of work: 2 h 35 in all.
const quick: TaskGraph = {
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
			duration: { nominal: 120 },
			after: ["s0.0"],
		},
		{
			id: "s1.0",
			kind: "step",
			section: 1,
			step: 0,
			duration: { nominal: 15 },
			consumes: ["a"],
			after: ["s0.0"],
		},
	],
	sections: [{ day: 0, intermediate: "a" }, { day: 0 }],
};

// A batter the day before, with a 20 to 48 h rest, baked on the day.
const twoDays: TaskGraph = {
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
			duration: { nominal: 1200, min: 1200, max: 2880 },
			after: ["s0.0"],
		},
		{
			id: "s1.0",
			kind: "step",
			section: 1,
			step: 0,
			duration: { nominal: 20 },
			consumes: ["a"],
			after: ["s0.0"],
		},
	],
	sections: [{ day: 1, intermediate: "a" }, { day: 0 }],
};

describe("tryServeAt", () => {
	it("says a time can be followed when nothing is left unresolved", () => {
		const c = tryServeAt({ graph: quick }, context(), "2026-10-12T20:00");
		expect(c).toMatchObject({ ok: true, adjustments: 0, visits: 2 });
		expect(c.startsAt).toBe("2026-10-12T17:25");
	});

	it("rejects a start in the past, with the reason and when it would start", () => {
		const c = tryServeAt({ graph: quick }, context(), "2026-10-10T11:00");
		expect(c.ok).toBe(false);
		expect(c.reasons.map((r) => r.code)).toEqual(["START_IN_PAST"]);
		expect(c.startsAt).toBe("2026-10-10T08:25");
	});
});

describe("findServeTimes", () => {
	const input = { graph: twoDays };

	it("tries each date at each meal time and rejects what cannot work", () => {
		const { candidates, rejected } = findServeTimes(input, context(), {
			from: "2026-10-10",
			to: "2026-10-12",
		});
		expect(DEFAULT_MEAL_TIMES).toEqual(["12:30", "20:00"]);
		// Nothing can be served on the 10th: the batter would start in the past.
		expect(rejected.map((r) => r.serveAt)).toContain("2026-10-10T12:30");
		expect(candidates.every((c) => c.serveAt >= "2026-10-11T00:00")).toBe(true);
		for (const r of rejected) expect(r.reasons.length).toBeGreaterThan(0);
	});

	it("ranks by fewer adjustments, then fewer visits, then the earliest", () => {
		const { candidates } = findServeTimes(input, context(), {
			from: "2026-10-12",
			to: "2026-10-15",
			limit: 10,
		});
		const key = (c: (typeof candidates)[number]) => [
			c.adjustments,
			c.visits,
			c.serveAt,
		];
		const sorted = [...candidates].sort((a, b) => {
			const [x, y] = [key(a), key(b)];
			return (
				(x[0] as number) - (y[0] as number) ||
				(x[1] as number) - (y[1] as number) ||
				String(x[2]).localeCompare(String(y[2]))
			);
		});
		expect(candidates.map((c) => c.serveAt)).toEqual(
			sorted.map((c) => c.serveAt),
		);
		expect(candidates.length).toBeGreaterThan(1);
	});

	it("honours the meal times, the bounds and the limit", () => {
		const { candidates, rejected } = findServeTimes(input, context(), {
			from: "2026-10-13T00:00",
			to: "2026-10-15T12:00",
			mealTimes: ["19:00"],
			limit: 2,
		});
		const all = [...candidates, ...rejected].map((c) => c.serveAt).sort();
		expect(all).toEqual(["2026-10-13T19:00", "2026-10-14T19:00"]);
		expect(candidates).toHaveLength(2);
	});
});

describe("earliestServe", () => {
	it("is the shortest the recipe takes after now, to five minutes", () => {
		const r = earliestServe({ graph: quick }, context());
		expect(r.found!.serveAt).toBe("2026-10-10T12:35");
		expect(r.found!.ok).toBe(true);
	});

	it("waits for the cook to be available", () => {
		const r = earliestServe(
			{ graph: quick },
			context({ now: "2026-10-10T21:50" }),
		);
		// The work starts at 08:00 the next morning.
		expect(r.found!.serveAt).toBe("2026-10-11T10:35");
	});

	it("gives up after the horizon and says where it stopped", () => {
		const r = earliestServe(
			{ graph: quick },
			context({ availability: { daily: [] } }),
		);
		expect(r.found).toBeUndefined();
		expect(r.searchedUntil >= "2026-10-24T10:00").toBe(true);
	});

	it("needs the present", () => {
		expect(() =>
			earliestServe({ graph: quick }, context({ now: undefined })),
		).toThrow(RangeError);
	});
});

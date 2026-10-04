import { describe, expect, it } from "bun:test";
import { groupsFromDays, sessionOverflows, sessionsOf } from "../src/sessions";
import type { ScheduleBlock } from "../src/types";

describe("groupsFromDays", () => {
	it("orders groups from the furthest day, sections in source order", () => {
		expect(groupsFromDays([2, 2, 1, 0, 0])).toEqual([[0, 1], [2], [3, 4]]);
	});
});

describe("sessionsOf", () => {
	it("bounds a session by its active blocks and ignores passive ones", () => {
		const blocks: ScheduleBlock[] = [
			{ kind: "prep", task: "s0.prep", section: 0, start: 0, end: 5 },
			{ kind: "step", task: "s0.0", section: 0, step: 0, start: 5, end: 15 },
			{
				kind: "passive",
				task: "s0.0.t0",
				section: 0,
				step: 0,
				start: 15,
				end: 900,
			},
			{ kind: "step", task: "s1.0", section: 1, step: 0, start: 900, end: 920 },
		];
		expect(sessionsOf(blocks, [[0], [1]], [1, 0])).toEqual([
			{ day: 1, start: 0, end: 15, sections: [0] },
			{ day: 0, start: 900, end: 920, sections: [1] },
		]);
	});

	it("skips a group without active work", () => {
		expect(sessionsOf([], [[0]], [0])).toEqual([]);
	});
});

describe("sessionOverflows", () => {
	const step = (
		section: number,
		start: number,
		end: number,
	): ScheduleBlock => ({
		kind: "step",
		task: `s${section}.0`,
		section,
		step: 0,
		start,
		end,
	});

	it("flags a session whose active work starts before its 24 h window", () => {
		// Day 1 must start after 3000 - 2 x 1440 = 120; it starts at 100.
		const blocks = [step(0, 100, 110), step(1, 2990, 3000)];
		const sessions = sessionsOf(blocks, [[0], [1]], [1, 0]);
		expect(sessionOverflows(sessions, blocks, 3000)).toEqual([
			{ code: "SESSION_OVERFLOW", section: 0, day: 1, overflowMinutes: 20 },
		]);
	});

	it("accepts a session that starts exactly when its window opens", () => {
		const blocks = [step(0, 120, 130), step(1, 2990, 3000)];
		const sessions = sessionsOf(blocks, [[0], [1]], [1, 0]);
		expect(sessionOverflows(sessions, blocks, 3000)).toEqual([]);
	});

	it("holds the day itself to a single 24 h window", () => {
		const blocks = [step(0, 0, 10), step(0, 1990, 2000)];
		const sessions = sessionsOf(blocks, [[0]], [0]);
		expect(sessionOverflows(sessions, blocks, 2000)).toEqual([
			{ code: "SESSION_OVERFLOW", section: 0, day: 0, overflowMinutes: 560 },
		]);
	});

	it("ignores a passive rest running through the night", () => {
		const blocks: ScheduleBlock[] = [
			step(0, 1500, 1510),
			{
				kind: "passive",
				task: "s0.0.t0",
				section: 0,
				step: 0,
				start: 0,
				end: 1500,
			},
		];
		const sessions = sessionsOf(blocks, [[0]], [0]);
		expect(sessionOverflows(sessions, blocks, 1510)).toEqual([]);
	});
});

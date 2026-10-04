import { describe, expect, it } from "bun:test";
import { groupsFromDays, sessionDays, sessionsOf } from "../src/sessions";
import type { ScheduleBlock } from "../src/types";

const anchor = (minutes?: number) => ({
	retro_planning: minutes === undefined ? null : { raw: "", minutes },
});

describe("sessionDays", () => {
	it("puts a section on the day of its own anchor", () => {
		expect(sessionDays([anchor(-4320), anchor(-1440), anchor(-60)])).toEqual([
			3, 1, 0,
		]);
	});

	it("gives an unanchored section the day of the next anchor", () => {
		expect(sessionDays([anchor(-2880), anchor(), anchor(-1440)])).toEqual([
			2, 1, 1,
		]);
	});

	it("puts trailing unanchored sections on day 0", () => {
		expect(sessionDays([anchor(-1440), anchor(), anchor()])).toEqual([1, 0, 0]);
	});

	it("takes the furthest day when anchors are out of order", () => {
		expect(sessionDays([anchor(-1440), anchor(-2880), anchor()])).toEqual([
			2, 2, 0,
		]);
	});

	it("rounds down on the absolute value: 36h is D-1, 12h is day 0", () => {
		expect(sessionDays([anchor(-2160), anchor(-720)])).toEqual([1, 0]);
	});

	it("reads the absolute value: -2160 minutes is a day back, not -2", () => {
		expect(Math.floor(-2160 / 1440)).toBe(-2); // what a signed floor would give
		expect(sessionDays([anchor(-2160)])).toEqual([1]);
		expect(sessionDays([anchor(2160)])).toEqual([1]);
	});

	it("keeps an anchor under 24 hours on day 0: -12h and -18h are not D-1", () => {
		expect(sessionDays([anchor(-720), anchor(-1080), anchor(-1439)])).toEqual([
			0, 0, 0,
		]);
	});

	it("opens D-1 from exactly 24 hours: -1d, -24h and -26h", () => {
		expect(sessionDays([anchor(-1440)])).toEqual([1]);
		expect(sessionDays([anchor(-1440), anchor(-1560)])).toEqual([1, 1]);
	});

	it("never reads a passive timer: only the sections' anchors count", () => {
		// A section carrying a 48h rest but no anchor has no `retro_planning`.
		expect(sessionDays([anchor(), anchor()])).toEqual([0, 0]);
	});

	it("treats an anchor without minutes as no anchor", () => {
		expect(
			sessionDays([{ retro_planning: { raw: "~{-?d}" } }, anchor(-1440)]),
		).toEqual([1, 1]);
	});

	it("is a single day without any anchor of a day or more", () => {
		expect(sessionDays([anchor(), anchor(-120), anchor()])).toEqual([0, 0, 0]);
	});
});

describe("groupsFromDays", () => {
	it("orders groups from the furthest day, sections in source order", () => {
		expect(groupsFromDays([2, 2, 1, 0, 0])).toEqual([[0, 1], [2], [3, 4]]);
	});
});

describe("sessionsOf", () => {
	it("bounds a session by its active blocks and ignores passive ones", () => {
		const blocks: ScheduleBlock[] = [
			{ kind: "prep", section: 0, start: 0, end: 5 },
			{ kind: "step", section: 0, step: 0, start: 5, end: 15 },
			{ kind: "passive", section: 0, step: 0, start: 15, end: 900 },
			{ kind: "step", section: 1, step: 0, start: 900, end: 920 },
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

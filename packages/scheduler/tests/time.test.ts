import { describe, expect, it } from "bun:test";
import {
	availableIntervals,
	gapsBetween,
	mergeIntervals,
} from "../src/availability";
import {
	addDays,
	daysBetween,
	parseClock,
	parseInstant,
	parseLocalIso,
	toLocal,
	toLocalIso,
	toUtcIso,
} from "../src/time";

const PARIS = "Europe/Paris";

describe("local time", () => {
	it("reads a wall-clock time in a zone", () => {
		expect(toUtcIso(parseLocalIso("2026-10-11T13:00", PARIS))).toBe(
			"2026-10-11T11:00:00Z",
		);
		expect(toUtcIso(parseLocalIso("2026-01-11 13:00", PARIS))).toBe(
			"2026-01-11T12:00:00Z",
		);
	});

	it("round-trips", () => {
		const t = parseLocalIso("2026-07-14T09:05", "Asia/Kolkata");
		expect(toLocalIso(t, "Asia/Kolkata")).toBe("2026-07-14T09:05");
	});

	it("moves a time the clocks skip to the next valid one", () => {
		// 2026-03-29, 02:30 does not exist in Paris.
		const t = parseLocalIso("2026-03-29T02:30", PARIS);
		expect(toLocalIso(t, PARIS)).toBe("2026-03-29T03:30");
	});

	it("takes the first of a time that happens twice", () => {
		// 2026-10-25, 02:30 happens at 00:30Z (summer time) and again at 01:30Z.
		const t = parseLocalIso("2026-10-25T02:30", PARIS);
		expect(toUtcIso(t)).toBe("2026-10-25T00:30:00Z");
	});

	it("lasts 25 hours on the day the clocks go back", () => {
		const a = parseLocalIso("2026-10-25T00:00", PARIS);
		const b = parseLocalIso("2026-10-26T00:00", PARIS);
		expect((b - a) / 60).toBe(25);
	});

	it("gives the weekday and the date", () => {
		expect(toLocal(parseLocalIso("2026-10-11T13:00", PARIS), PARIS)).toEqual({
			date: "2026-10-11",
			minuteOfDay: 780,
			weekday: "sun",
		});
	});

	it("reads an instant with an offset or a Z as is", () => {
		expect(parseInstant("2026-10-11T13:00:00+02:00", "UTC")).toBe(
			parseInstant("2026-10-11T11:00:00Z", PARIS),
		);
		expect(parseInstant("2026-10-11T13:00", PARIS)).toBe(
			parseInstant("2026-10-11T11:00:00Z", PARIS),
		);
	});

	it("refuses what is not a date-time or a zone", () => {
		expect(() => parseLocalIso("tomorrow", PARIS)).toThrow(RangeError);
		expect(() => parseLocalIso("2026-13-01T10:00", PARIS)).toThrow(RangeError);
		expect(() => parseLocalIso("2026-10-11T25:00", PARIS)).toThrow(RangeError);
		expect(() => toLocal(0, "Nowhere/Land")).toThrow(RangeError);
		expect(() => parseClock("8h")).toThrow(RangeError);
	});

	it("counts days on the calendar", () => {
		expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
		expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
		expect(daysBetween("2026-10-09", "2026-10-11")).toBe(2);
		expect(daysBetween("2026-10-11", "2026-10-09")).toBe(-2);
	});
});

describe("availability", () => {
	const around = (from: string, to: string) =>
		[parseLocalIso(from, PARIS), parseLocalIso(to, PARIS)] as const;
	const local = (i: { start: number; end: number }) => [
		toLocalIso(i.start, PARIS),
		toLocalIso(i.end, PARIS),
	];

	it("reads the daily ranges", () => {
		const [from, to] = around("2026-10-10T00:00", "2026-10-11T23:00");
		const intervals = availableIntervals(
			{
				daily: [
					{ start: "08:00", end: "12:00" },
					{ start: "14:00", end: "18:00" },
				],
			},
			PARIS,
			from,
			to,
		);
		expect(intervals.map(local)).toContainEqual([
			"2026-10-10T08:00",
			"2026-10-10T12:00",
		]);
		expect(intervals.map(local)).toContainEqual([
			"2026-10-11T14:00",
			"2026-10-11T18:00",
		]);
	});

	it("lets a date override a weekday override the daily ranges", () => {
		const [from, to] = around("2026-10-10T00:00", "2026-10-12T23:00");
		const intervals = availableIntervals(
			{
				daily: [{ start: "08:00", end: "09:00" }],
				weekdays: { sun: [{ start: "10:00", end: "11:00" }] },
				dates: { "2026-10-12": [{ start: "12:00", end: "13:00" }] },
			},
			PARIS,
			from,
			to,
		);
		const seen = intervals.map(local);
		expect(seen).toContainEqual(["2026-10-10T08:00", "2026-10-10T09:00"]);
		expect(seen).toContainEqual(["2026-10-11T10:00", "2026-10-11T11:00"]);
		expect(seen).not.toContainEqual(["2026-10-11T08:00", "2026-10-11T09:00"]);
		expect(seen).toContainEqual(["2026-10-12T12:00", "2026-10-12T13:00"]);
		expect(seen).not.toContainEqual(["2026-10-12T08:00", "2026-10-12T09:00"]);
	});

	it("reads an empty list as not available that day", () => {
		const [from, to] = around("2026-10-10T00:00", "2026-10-12T23:00");
		const intervals = availableIntervals(
			{ daily: [{ start: "08:00", end: "09:00" }], weekdays: { sun: [] } },
			PARIS,
			from,
			to,
		);
		expect(
			intervals.map(local).some(([s]) => s!.startsWith("2026-10-11")),
		).toBe(false);
	});

	it("runs a range past midnight, and joins it to the next day's", () => {
		const [from, to] = around("2026-10-10T00:00", "2026-10-11T23:00");
		const intervals = availableIntervals(
			{ daily: [{ start: "22:00", end: "02:00" }] },
			PARIS,
			from,
			to,
		);
		expect(intervals.map(local)).toContainEqual([
			"2026-10-10T22:00",
			"2026-10-11T02:00",
		]);
	});

	it("merges overlapping spans and finds the gaps", () => {
		expect(
			mergeIntervals([
				{ start: 5, end: 8 },
				{ start: 0, end: 3 },
				{ start: 2, end: 6 },
			]),
		).toEqual([{ start: 0, end: 8 }]);
		expect(
			gapsBetween(
				[
					{ start: 2, end: 4 },
					{ start: 6, end: 7 },
				],
				0,
				10,
			),
		).toEqual([
			{ start: 0, end: 2 },
			{ start: 4, end: 6 },
			{ start: 7, end: 10 },
		]);
	});
});

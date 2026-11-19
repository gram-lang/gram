import { describe, expect, it } from "bun:test";
import { ALL_DAY, availabilityEntries, parseAvailability } from "../src/index";

describe("parseAvailability", () => {
	it("is all day without any entry", () => {
		expect(parseAvailability([])).toEqual({ ok: true, availability: ALL_DAY });
	});

	it("reads every day, a day of the week and a date", () => {
		expect(
			parseAvailability([
				"08:00-09:00,18:00-22:00",
				"FRI=18:00-23:00",
				"fri=07:00-08:00",
				"2026-10-09=none",
			]),
		).toEqual({
			ok: true,
			availability: {
				daily: [
					{ start: "08:00", end: "09:00" },
					{ start: "18:00", end: "22:00" },
				],
				weekdays: {
					fri: [
						{ start: "18:00", end: "23:00" },
						{ start: "07:00", end: "08:00" },
					],
				},
				dates: { "2026-10-09": [] },
			},
		});
	});

	it("reads ranges in 12 hours, padding and with spaces around the dash", () => {
		expect(
			parseAvailability([
				"8am-10pm",
				"fri=8:30 am - 10:00 PM, 11pm-12am",
				"sat=6pm-12am",
				"9:00-17:00",
			]),
		).toEqual({
			ok: true,
			availability: {
				daily: [
					{ start: "08:00", end: "22:00" },
					{ start: "09:00", end: "17:00" },
				],
				weekdays: {
					fri: [
						{ start: "08:30", end: "22:00" },
						{ start: "23:00", end: "24:00" },
					],
					sat: [{ start: "18:00", end: "24:00" }],
				},
			},
		});
	});

	it("takes the en dash of a range copied from typeset text", () => {
		expect(parseAvailability(["8am\u201310pm"])).toEqual({
			ok: true,
			availability: { daily: [{ start: "08:00", end: "22:00" }] },
		});
	});

	it("takes 12 and 24 hours together, and midnight at the start as 00:00", () => {
		expect(parseAvailability(["12am-2am,8am-22:00"])).toEqual({
			ok: true,
			availability: {
				daily: [
					{ start: "00:00", end: "02:00" },
					{ start: "08:00", end: "22:00" },
				],
			},
		});
	});

	it("says which range or key is wrong, as data", () => {
		expect(parseAvailability(["08:00-22:00,8-22"])).toEqual({
			ok: false,
			reason: "range",
			entry: "08:00-22:00,8-22",
			part: "8-22",
		});
		expect(parseAvailability(["someday=08:00-22:00"])).toEqual({
			ok: false,
			reason: "key",
			entry: "someday=08:00-22:00",
			part: "someday",
		});
		// Shaped like a date, but February has no 30th: it would never apply.
		expect(parseAvailability(["2026-02-30=none"])).toEqual({
			ok: false,
			reason: "key",
			entry: "2026-02-30=none",
			part: "2026-02-30",
		});
		expect(parseAvailability(["2028-02-29=none"])).toMatchObject({
			ok: true,
		});
		expect(parseAvailability(["25:00-26:00"])).toMatchObject({
			ok: false,
			reason: "range",
		});
		expect(parseAvailability(["08:00-09:00, 13pm-2pm"])).toEqual({
			ok: false,
			reason: "range",
			entry: "08:00-09:00, 13pm-2pm",
			part: "13pm-2pm",
		});
		// Midnight never starts a range as the end of the day.
		expect(parseAvailability(["24:00-24:00"])).toMatchObject({
			ok: false,
			reason: "range",
		});
	});

	it("never shares the default it returns", () => {
		const parsed = parseAvailability([]);
		if (parsed.ok) parsed.availability.daily.push({ start: "x", end: "y" });
		expect(ALL_DAY.daily).toHaveLength(1);
	});
});

describe("availabilityEntries", () => {
	it("reads one entry or a list of them", () => {
		expect(availabilityEntries("08:00-22:00")).toEqual(["08:00-22:00"]);
		expect(availabilityEntries(["08:00-12:00", "fri=none"])).toEqual([
			"08:00-12:00",
			"fri=none",
		]);
		expect(availabilityEntries("")).toEqual([]);
	});

	it("is undefined for anything else", () => {
		expect(availabilityEntries(8)).toBeUndefined();
		expect(availabilityEntries(["08:00-12:00", 9])).toBeUndefined();
		expect(availabilityEntries({ daily: [] })).toBeUndefined();
		expect(availabilityEntries(undefined)).toBeUndefined();
	});
});

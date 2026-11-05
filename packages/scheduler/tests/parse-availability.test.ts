import { describe, expect, it } from "bun:test";
import { ALL_DAY, parseAvailability } from "../src/index";

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
		expect(parseAvailability(["25:00-26:00"])).toMatchObject({
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

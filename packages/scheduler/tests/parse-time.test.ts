import { describe, expect, it } from "bun:test";
import { parseLocalDateTime, parseTimeOfDay } from "../src/index";

describe("parseTimeOfDay", () => {
	it("reads 24 hours, padding the hour", () => {
		expect(parseTimeOfDay("13:00")).toBe("13:00");
		expect(parseTimeOfDay("9:05")).toBe("09:05");
		expect(parseTimeOfDay(" 00:00 ")).toBe("00:00");
		expect(parseTimeOfDay("23:59")).toBe("23:59");
	});

	it("reads 12 hours with am/pm, spaces and case free", () => {
		expect(parseTimeOfDay("8am")).toBe("08:00");
		expect(parseTimeOfDay("8 am")).toBe("08:00");
		expect(parseTimeOfDay("8:30am")).toBe("08:30");
		expect(parseTimeOfDay("1:00 PM")).toBe("13:00");
		expect(parseTimeOfDay("10pm")).toBe("22:00");
		expect(parseTimeOfDay("11:59 Pm")).toBe("23:59");
		expect(parseTimeOfDay("7 p.m.")).toBe("19:00");
		expect(parseTimeOfDay("6:15 a.m.")).toBe("06:15");
	});

	it("reads back a time as Intl writes it, with a narrow no-break space", () => {
		const written = new Intl.DateTimeFormat("en-US", {
			hour: "numeric",
			minute: "2-digit",
			timeZone: "UTC",
		}).format(Date.UTC(2026, 0, 1, 13, 5));
		expect(parseTimeOfDay(written)).toBe("13:05");
		expect(parseTimeOfDay("1:05\u202fPM")).toBe("13:05");
	});

	it("reads 12am as midnight and 12pm as noon", () => {
		expect(parseTimeOfDay("12am")).toBe("00:00");
		expect(parseTimeOfDay("12:30 am")).toBe("00:30");
		expect(parseTimeOfDay("12pm")).toBe("12:00");
		expect(parseTimeOfDay("12:30pm")).toBe("12:30");
	});

	it("reads the midnight that ends a range as 24:00, only there", () => {
		expect(parseTimeOfDay("12am", { end: true })).toBe("24:00");
		expect(parseTimeOfDay("12:00 AM", { end: true })).toBe("24:00");
		expect(parseTimeOfDay("24:00", { end: true })).toBe("24:00");
		expect(parseTimeOfDay("24:00")).toBeNull();
		// Half past midnight is not the end of the day.
		expect(parseTimeOfDay("12:30am", { end: true })).toBe("00:30");
		expect(parseTimeOfDay("00:00", { end: true })).toBe("00:00");
	});

	it("refuses what is neither", () => {
		for (const text of [
			"8",
			"",
			"noon",
			"8h",
			"13pm",
			"0am",
			"0:30am",
			"12:60pm",
			"24:30",
			"25:00",
			"8:5",
			"8:30 xm",
			"8:30am pm",
		]) {
			expect(parseTimeOfDay(text)).toBeNull();
		}
		expect(parseTimeOfDay("24:30", { end: true })).toBeNull();
	});
});

describe("parseLocalDateTime", () => {
	const local = (text: string) => parseLocalDateTime(text);

	it("reads a local date and a time, in 24 or 12 hours", () => {
		expect(local("2026-10-11 13:00")).toEqual({
			ok: true,
			local: "2026-10-11T13:00",
		});
		expect(local("2026-10-11T9:05")).toEqual({
			ok: true,
			local: "2026-10-11T09:05",
		});
		expect(local("2026-10-11 1:00 pm")).toEqual({
			ok: true,
			local: "2026-10-11T13:00",
		});
		expect(local(" 2026-10-11T1pm ")).toEqual({
			ok: true,
			local: "2026-10-11T13:00",
		});
		expect(local("2026-10-11 12am")).toEqual({
			ok: true,
			local: "2026-10-11T00:00",
		});
	});

	it("says whether the date or the shape is wrong, as data", () => {
		expect(local("2026-02-30 20:00")).toEqual({
			ok: false,
			reason: "date",
			date: "2026-02-30",
		});
		for (const text of [
			"2026-10-11 24:00",
			"2026-10-11 13pm",
			"2026-10-11",
			"tomorrow at noon",
		]) {
			expect(local(text)).toEqual({ ok: false, reason: "format" });
		}
	});
});

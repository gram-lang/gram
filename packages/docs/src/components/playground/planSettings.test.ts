import { describe, expect, it } from "bun:test";
import { WEEKDAYS } from "@gram-lang/scheduler";
import {
	type PlanSettings,
	dayEnabled,
	dayFrom,
	dayTo,
	serveAtLabel,
	timeZoneChoices,
	weekdayNames,
	withCustomWeekdays,
	withDayTime,
	withDayToggled,
	withPlanField,
} from "./planSettings";

const plan = (extra: Partial<PlanSettings> = {}): PlanSettings => ({
	serveAt: "",
	timeZone: "Europe/Paris",
	from: "09:00",
	to: "20:00",
	...extra,
});

describe("the hours of each day", () => {
	it("opens every day, with the daily hours, until the plan says otherwise", () => {
		expect(dayEnabled(plan(), "mon")).toBe(true);
		expect(dayFrom(plan(), "mon")).toBe("09:00");
		expect(dayTo(plan(), "mon")).toBe("20:00");
		expect(dayEnabled(undefined, "mon")).toBe(true);
		expect(dayFrom(undefined, "mon")).toBe("08:00");
		expect(dayTo(undefined, "mon")).toBe("22:00");
	});

	it("reads the hours of a day that has its own", () => {
		const custom = plan({
			weekdays: { sat: { enabled: false, from: "10:00", to: "23:00" } },
		});
		expect(dayEnabled(custom, "sat")).toBe(false);
		expect(dayFrom(custom, "sat")).toBe("10:00");
		expect(dayTo(custom, "sat")).toBe("23:00");
		// A day it does not mention keeps the daily hours.
		expect(dayEnabled(custom, "mon")).toBe(true);
		expect(dayFrom(custom, "mon")).toBe("09:00");
	});
});

describe("changing the plan", () => {
	it("changes one field and leaves the rest", () => {
		const before = plan({ serveAt: "2026-10-11T13:00" });
		const after = withPlanField(before, "timeZone", "UTC");
		expect(after).toEqual({ ...before, timeZone: "UTC" });
		expect(before.timeZone).toBe("Europe/Paris");
	});

	it("starts every day from the daily hours the first time the hours by day are on", () => {
		const after = withCustomWeekdays(plan(), true);
		expect(after.customWeekdays).toBe(true);
		expect(Object.keys(after.weekdays ?? {})).toEqual([...WEEKDAYS]);
		for (const day of WEEKDAYS) {
			expect(after.weekdays?.[day]).toEqual({
				enabled: true,
				from: "09:00",
				to: "20:00",
			});
		}
	});

	it("keeps the hours already given when they are switched off and on again", () => {
		const given = plan({
			customWeekdays: true,
			weekdays: { tue: { enabled: true, from: "12:00", to: "13:00" } },
		});
		const off = withCustomWeekdays(given, false);
		expect(off.customWeekdays).toBe(false);
		expect(off.weekdays).toEqual(given.weekdays);
		expect(withCustomWeekdays(off, true).weekdays).toEqual(given.weekdays);
	});

	it("falls back to the default hours when the daily ones are empty", () => {
		const after = withCustomWeekdays(plan({ from: "", to: "" }), true);
		expect(after.weekdays?.mon).toEqual({
			enabled: true,
			from: "08:00",
			to: "22:00",
		});
	});

	it("closes an open day and opens a closed one, keeping its hours", () => {
		const closed = withDayToggled(plan(), "mon");
		expect(closed.weekdays?.mon).toEqual({
			enabled: false,
			from: "09:00",
			to: "20:00",
		});
		const open = withDayToggled(closed, "mon");
		expect(open.weekdays?.mon?.enabled).toBe(true);
	});

	it("changes the arrival or the departure of one day, from the daily hours if it had none", () => {
		const after = withDayTime(plan(), "wed", "from", "11:30");
		expect(after.weekdays?.wed).toEqual({
			enabled: true,
			from: "11:30",
			to: "20:00",
		});
		const again = withDayTime(after, "wed", "to", "15:00");
		expect(again.weekdays?.wed).toEqual({
			enabled: true,
			from: "11:30",
			to: "15:00",
		});
	});
});

describe("time zones", () => {
	it("offers the browser's own first, then UTC, then the rest", () => {
		expect(
			timeZoneChoices(
				undefined,
				["Asia/Tokyo", "Europe/Paris"],
				"Europe/Paris",
			),
		).toEqual(["Europe/Paris", "UTC", "Asia/Tokyo"]);
	});

	it("does not list UTC twice when it is the browser's own", () => {
		expect(timeZoneChoices(undefined, ["Asia/Tokyo", "UTC"], "UTC")).toEqual([
			"UTC",
			"Asia/Tokyo",
		]);
	});

	it("keeps the zone already chosen, even if the browser does not list it", () => {
		expect(
			timeZoneChoices("Atlantic/Reykjavik", ["Asia/Tokyo"], "UTC"),
		).toEqual(["UTC", "Asia/Tokyo", "Atlantic/Reykjavik"]);
	});

	it("offers the browser's zone and UTC when the browser lists none", () => {
		expect(timeZoneChoices(undefined, [], "Europe/Paris")).toEqual([
			"Europe/Paris",
			"UTC",
		]);
	});
});

describe("words for days and times", () => {
	it("names the seven days in order, capitalized, in the language asked", () => {
		const en = weekdayNames("en");
		expect(WEEKDAYS.map((d) => en[d])).toEqual([
			"Monday",
			"Tuesday",
			"Wednesday",
			"Thursday",
			"Friday",
			"Saturday",
			"Sunday",
		]);
		const fr = weekdayNames("fr");
		expect(fr.mon).toBe("Lundi");
		expect(fr.sun).toBe("Dimanche");
	});

	it("writes a serving time in the language asked, the browser's zone never moving it", () => {
		expect(serveAtLabel("2026-10-11T13:00", "en")).toContain("13:00");
		expect(serveAtLabel("2026-10-11T13:00", "en")).toContain("Oct");
		expect(serveAtLabel("2026-10-11T13:00", "fr")).toContain("13:00");
		expect(serveAtLabel("2026-10-11T13:00", "fr")).not.toBe(
			serveAtLabel("2026-10-11T13:00", "en"),
		);
	});

	it("gives back what it cannot read", () => {
		expect(serveAtLabel("2026-13-45T99:99", "en")).toBe("2026-13-45T99:99");
	});
});

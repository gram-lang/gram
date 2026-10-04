import { describe, expect, it } from "bun:test";
import { GramCLIError } from "../src/errors";
import { resolvePlanContext } from "../src/services/plan-options";
import {
	collectFlag,
	parseAvailability,
	parseServe,
	parseTimeZone,
} from "../src/services/plan-flags";

const messageOf = (fn: () => unknown) => {
	try {
		fn();
	} catch (e) {
		expect(e).toBeInstanceOf(GramCLIError);
		return (e as Error).message;
	}
	throw new Error("did not throw");
};

describe("collectFlag", () => {
	it("reads a flag given several times, with a space or an equals sign", () => {
		expect(
			collectFlag(
				[
					"f.gram",
					"--available",
					"08:00-22:00",
					"--available=fri=18:00-22:00",
					"--serve",
					"x",
				],
				"available",
			),
		).toEqual(["08:00-22:00", "fri=18:00-22:00"]);
	});

	it("finds nothing when the flag is absent or has no value", () => {
		expect(collectFlag(["f.gram"], "available")).toEqual([]);
		expect(collectFlag(["--available"], "available")).toEqual([]);
	});
});

describe("parseServe", () => {
	it("reads a local date and time, with a space or a T", () => {
		expect(parseServe("2026-10-11 13:00")).toBe("2026-10-11T13:00");
		expect(parseServe("2026-10-11T9:05")).toBe("2026-10-11T09:05");
	});

	it("explains what it expects", () => {
		expect(messageOf(() => parseServe("sunday"))).toContain(
			'"2026-10-11 13:00"',
		);
		expect(messageOf(() => parseServe(undefined))).toContain("--serve");
	});
});

describe("parseTimeZone", () => {
	const machine = Intl.DateTimeFormat().resolvedOptions().timeZone;

	it("accepts an IANA zone and falls back on the machine's", () => {
		expect(parseTimeZone("Europe/Paris")).toBe("Europe/Paris");
		expect(parseTimeZone(undefined)).toBe(machine);
		expect(parseTimeZone("")).toBe(machine);
	});

	it("takes the configured zone before the machine's", () => {
		expect(parseTimeZone(undefined, "Asia/Tokyo")).toBe("Asia/Tokyo");
		expect(parseTimeZone("", "Asia/Tokyo")).toBe("Asia/Tokyo");
	});

	it("takes the flag before the configured zone", () => {
		expect(parseTimeZone("Europe/Paris", "Asia/Tokyo")).toBe("Europe/Paris");
	});

	it("does not look at the configured zone when the flag is given", () => {
		expect(parseTimeZone("Europe/Paris", "Mars/Olympus")).toBe("Europe/Paris");
	});

	it("refuses a zone that does not exist, by name", () => {
		expect(messageOf(() => parseTimeZone("Mars/Olympus"))).toContain(
			"Mars/Olympus",
		);
	});

	it("says a bad configured zone comes from the setting, and how to fix it", () => {
		const message = messageOf(() => parseTimeZone(undefined, "Mars/Olympus"));
		expect(message).toContain("Mars/Olympus");
		expect(message).toContain("timezone");
		expect(message).toContain("gram config set timezone");
	});
});

describe("parseAvailability", () => {
	it("is available all day without any entry", () => {
		expect(parseAvailability([])).toEqual({
			daily: [{ start: "00:00", end: "24:00" }],
		});
	});

	it("reads a default range, a weekday and a date", () => {
		expect(
			parseAvailability(["08:00-22:00", "fri=18:00-22:00", "2026-10-09=none"]),
		).toEqual({
			daily: [{ start: "08:00", end: "22:00" }],
			weekdays: { fri: [{ start: "18:00", end: "22:00" }] },
			dates: { "2026-10-09": [] },
		});
	});

	it("takes several ranges after one key, or the same key again", () => {
		expect(
			parseAvailability([
				"sat=08:00-09:00,18:00-22:00",
				"sat=23:00-02:00",
				"07:00-08:00",
			]),
		).toEqual({
			daily: [{ start: "07:00", end: "08:00" }],
			weekdays: {
				sat: [
					{ start: "08:00", end: "09:00" },
					{ start: "18:00", end: "22:00" },
					{ start: "23:00", end: "02:00" },
				],
			},
		});
	});

	it("reads a weekday in any case, and none as not available", () => {
		expect(parseAvailability(["SUN=none"])).toMatchObject({
			weekdays: { sun: [] },
		});
	});

	it("refuses what it cannot read, saying what it expects", () => {
		expect(messageOf(() => parseAvailability(["8-22"]))).toContain(
			"08:00-22:00",
		);
		expect(messageOf(() => parseAvailability(["fri=18:00"]))).toContain(
			"18:00",
		);
		expect(
			messageOf(() => parseAvailability(["someday=08:00-22:00"])),
		).toContain("someday");
		expect(messageOf(() => parseAvailability(["25:00-26:00"]))).toContain(
			"25:00",
		);
	});
});

describe("resolvePlanContext", () => {
	const flags = (args: Record<string, unknown>, raw: string[] = []) =>
		resolvePlanContext(args, raw, {});

	it("is no plan without --serve", () => {
		expect(flags({})).toBeUndefined();
	});

	it("reads the serving time, the zone, the availability and the present", () => {
		const context = flags(
			{
				serve: "2026-10-11 13:00",
				tz: "Europe/Paris",
				now: "2026-10-01T09:00:00Z",
			},
			["--available", "08:00-22:00"],
		)!;
		expect(context).toEqual({
			serveAt: "2026-10-11T13:00",
			timeZone: "Europe/Paris",
			availability: { daily: [{ start: "08:00", end: "22:00" }] },
			now: "2026-10-01T09:00:00Z",
		});
	});

	it("takes the configured zone, and the present from the clock", () => {
		const context = resolvePlanContext({ serve: "2026-10-11 13:00" }, [], {
			timezone: "Asia/Tokyo",
		})!;
		expect(context.timeZone).toBe("Asia/Tokyo");
		expect(Date.parse(context.now)).toBeGreaterThan(0);
	});

	it("refuses a plan flag that would be ignored for want of --serve", () => {
		expect(messageOf(() => flags({ tz: "Europe/Paris" }))).toContain("--serve");
		expect(
			messageOf(() => flags({}, ["--available", "08:00-22:00"])),
		).toContain("--serve");
		expect(messageOf(() => flags({ now: "2026-10-01T09:00:00Z" }))).toContain(
			"--serve",
		);
	});

	it("insists on --serve when the command needs a plan", () => {
		expect(
			messageOf(() => resolvePlanContext({}, [], {}, { required: true })),
		).toContain("--serve");
	});
});

import { getView } from "@gram-lang/renderer";
import { describe, expect, it } from "bun:test";
import { GramCLIError } from "../src/errors";
import { resolveExportView } from "../src/services/plan-options";
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

	it("takes the availability setting of the config without --available", () => {
		expect(parseAvailability([], "08:00-22:00")).toEqual({
			daily: [{ start: "08:00", end: "22:00" }],
		});
		expect(parseAvailability([], ["09:00-21:00", "sun=none"])).toEqual({
			daily: [{ start: "09:00", end: "21:00" }],
			weekdays: { sun: [] },
		});
		expect(parseAvailability([], "")).toEqual({
			daily: [{ start: "00:00", end: "24:00" }],
		});
	});

	it("lets --available replace the setting, not add to it", () => {
		expect(parseAvailability(["18:00-22:00"], ["08:00-09:00"])).toEqual({
			daily: [{ start: "18:00", end: "22:00" }],
		});
	});

	it("names the setting when it is the setting that is wrong", () => {
		const range = messageOf(() => parseAvailability([], "8-22"));
		expect(range).toContain("`availability` setting of .gram/config.yaml");
		expect(range).toContain("gram config set availability");
		expect(
			messageOf(() => parseAvailability([], ["someday=08:00-22:00"])),
		).toContain('Unknown availability key "someday"');
		expect(messageOf(() => parseAvailability([], 8))).toContain(
			"must be an entry like 08:00-22:00",
		);
		expect(messageOf(() => parseAvailability(["8-22"]))).toContain(
			"Expected --available like",
		);
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

const recipeView = getView("recipe");
const runSheetView = getView("runSheet");

describe("resolveExportView", () => {
	const view = (args: Record<string, unknown>, raw: string[] = []) =>
		resolveExportView(args, raw, {});

	it("is the recipe by default", () => {
		expect(view({})).toEqual({ view: recipeView });
		expect(view({ view: "recipe" })).toEqual({ view: recipeView });
	});

	it("reads the serving time, the zone, the availability and the present for the run sheet", () => {
		expect(
			view(
				{
					view: "run-sheet",
					serve: "2026-10-11 13:00",
					tz: "Europe/Paris",
					now: "2026-10-01T09:00:00Z",
				},
				["--available", "08:00-22:00"],
			),
		).toEqual({
			view: runSheetView,
			serveAt: "2026-10-11T13:00",
			kitchen: {
				timeZone: "Europe/Paris",
				availability: { daily: [{ start: "08:00", end: "22:00" }] },
				now: "2026-10-01T09:00:00Z",
			},
		});
	});

	it("reads the configured availability for the run sheet", () => {
		const choice = resolveExportView({ view: "run-sheet" }, [], {
			availability: "fri=18:00-22:00",
		});
		expect(choice.kitchen?.availability).toEqual({
			daily: [],
			weekdays: { fri: [{ start: "18:00", end: "22:00" }] },
		});
	});

	it("lays the run sheet out in days without --serve, in the configured zone", () => {
		const choice = resolveExportView({ view: "run-sheet" }, [], {
			timezone: "Asia/Tokyo",
		});
		expect(choice.view).toBe(runSheetView);
		expect(choice.serveAt).toBeUndefined();
		expect(choice.kitchen?.timeZone).toBe("Asia/Tokyo");
		expect(Date.parse(choice.kitchen?.now ?? "")).toBeGreaterThan(0);
	});

	it("refuses a plan flag with the recipe, which reads the same at any time", () => {
		for (const [args, raw] of [
			[{ serve: "2026-10-11 13:00" }, []],
			[{ tz: "Europe/Paris" }, []],
			[{}, ["--available", "08:00-22:00"]],
			[{ now: "2026-10-01T09:00:00Z" }, []],
		] as const) {
			expect(messageOf(() => view(args, [...raw]))).toContain(
				"--view run-sheet",
			);
		}
	});

	it("refuses an unknown view", () => {
		expect(messageOf(() => view({ view: "gantt" }))).toContain("gantt");
	});
});

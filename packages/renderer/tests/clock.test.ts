import { describe, expect, it } from "bun:test";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import {
	type ClockMode,
	type Format,
	type PrepareViewsOptions,
	chooseClock,
	formatClock,
	formatClockRange,
	hourCycleOf,
	prepareViews,
	render,
	resolveHourCycle,
	suggestServeTimes,
	systemLocale,
} from "../src/index";

describe("hourCycleOf", () => {
	it("reads 12 hours where the reader's region writes them", () => {
		for (const locale of ["en-US", "en-CA", "en-AU", "en-IN", "en_US.UTF-8"]) {
			expect(hourCycleOf(locale)).toBe("h12");
		}
	});

	it("reads 24 hours elsewhere, and without a region", () => {
		for (const locale of [
			"en-GB",
			"en-IE",
			"fr-FR",
			"fr-CA",
			"de-DE",
			"fr_FR.UTF-8",
			// No region: the language of the words says nothing of the clock.
			"en",
			"fr",
			undefined,
			"",
			// Not a locale.
			"C",
			"POSIX",
			"%%",
		]) {
			expect(hourCycleOf(locale)).toBe("h23");
		}
	});

	it("follows an explicit hour cycle of the locale", () => {
		expect(hourCycleOf("en-US-u-hc-h23")).toBe("h23");
		expect(hourCycleOf("fr-FR-u-hc-h12")).toBe("h12");
	});
});

describe("resolveHourCycle", () => {
	it("takes the clock the setting names, else the reader's", () => {
		expect(resolveHourCycle("12h", "fr-FR")).toBe("h12");
		expect(resolveHourCycle("24h", "en-US")).toBe("h23");
		expect(resolveHourCycle("auto", "en-US")).toBe("h12");
		expect(resolveHourCycle("auto", "en-GB")).toBe("h23");
		// The renderer never guesses the reader.
		expect(resolveHourCycle("auto", undefined)).toBe("h23");
	});
});

describe("systemLocale", () => {
	it("reads LC_ALL, then LC_TIME, then LANG", () => {
		expect(
			systemLocale({ LC_ALL: "en_US.UTF-8", LC_TIME: "fr_FR", LANG: "de_DE" }),
		).toBe("en_US.UTF-8");
		expect(systemLocale({ LC_TIME: "en_GB.UTF-8", LANG: "en_US.UTF-8" })).toBe(
			"en_GB.UTF-8",
		);
		expect(systemLocale({ LANG: "en_US.UTF-8" })).toBe("en_US.UTF-8");
	});

	it("names no locale for C and POSIX, which name no region", () => {
		expect(systemLocale({ LC_ALL: "C", LANG: "en_US.UTF-8" })).toBeUndefined();
		expect(systemLocale({ LANG: "C.UTF-8" })).toBeUndefined();
		expect(systemLocale({ LANG: "POSIX" })).toBeUndefined();
	});

	it("names no locale without any variable, where the runtime would say en-US", () => {
		expect(systemLocale({})).toBeUndefined();
		expect(systemLocale({}, "linux")).toBeUndefined();
		expect(systemLocale({}, "darwin")).toBeUndefined();
	});

	it("takes the runtime's locale on Windows, which follows the system's region", () => {
		expect(systemLocale({}, "win32")).toBe(
			Intl.DateTimeFormat().resolvedOptions().locale,
		);
		expect(systemLocale({ LANG: "en_GB.UTF-8" }, "win32")).toBe("en_GB.UTF-8");
	});
});

describe("chooseClock", () => {
	it("takes the first clock chosen, auto meaning not chosen", () => {
		expect(chooseClock(undefined, "12h", "24h")).toBe("12h");
		expect(chooseClock("auto", "24h")).toBe("24h");
		expect(chooseClock("12h", "24h")).toBe("12h");
		expect(chooseClock(undefined, "auto")).toBe("auto");
		expect(chooseClock()).toBe("auto");
	});
});

describe("formatClock", () => {
	it("writes 24 hours as they are", () => {
		expect(formatClock("09:05")).toBe("09:05");
		expect(formatClock("21:40", "h23")).toBe("21:40");
	});

	it("writes 12 hours with the marks of the words' language", () => {
		const plain = (text: string) => text.replace(/\s/g, " ");
		expect(plain(formatClock("13:05", "h12"))).toBe("1:05 PM");
		expect(plain(formatClock("09:00", "h12", "en"))).toBe("9:00 AM");
		expect(plain(formatClock("00:00", "h12"))).toBe("12:00 AM");
		expect(plain(formatClock("12:00", "h12"))).toBe("12:00 PM");
		// The midnight that ends a day.
		expect(plain(formatClock("24:00", "h12"))).toBe("12:00 AM");
		expect(plain(formatClock("13:05", "h12", "es"))).toMatch(
			/^1:05 p\.\s?m\.$/,
		);
	});
});

describe("formatClockRange", () => {
	const plain = (text: string) => text.replace(/\s/g, " ");

	it("joins 24 hours as they are", () => {
		expect(formatClockRange("18:55", "19:45", " – ")).toBe("18:55 – 19:45");
	});

	it("writes a day period the two times share once", () => {
		expect(plain(formatClockRange("18:55", "19:45", " – ", "h12"))).toBe(
			"6:55 – 7:45 PM",
		);
		expect(plain(formatClockRange("09:00", "10:30", " → ", "h12"))).toBe(
			"9:00 → 10:30 AM",
		);
		// Where the period leads, the second time drops it.
		expect(plain(formatClockRange("09:00", "10:30", " – ", "h12", "ko"))).toBe(
			"오전 9:00 – 10:30",
		);
	});

	it("keeps both across noon or midnight", () => {
		expect(plain(formatClockRange("11:30", "12:10", " – ", "h12"))).toBe(
			"11:30 AM – 12:10 PM",
		);
		expect(plain(formatClockRange("23:30", "24:00", " – ", "h12"))).toBe(
			"11:30 PM – 12:00 AM",
		);
	});
});

const BREAD = compile(
	getAST(`---
title: Country bread
portions: 4
---

## Dough ->&dough

[Mix] Mix @flour{500g} with @water{350ml} and knead ~{20min}.

[Rise] Let it rise ~_{8-16h}.

## Bake

[Bake] Shape &dough{850g} and bake at ^{230C} for ~{30min}.
`),
);

const KITCHEN = {
	timeZone: "Europe/Paris",
	availability: { daily: [{ start: "08:00", end: "22:00" }] },
	now: "2026-10-09T10:00",
};
const CALENDAR: PrepareViewsOptions = {
	kitchen: KITCHEN,
	serveAt: "2026-10-11T13:00",
};

const sheetOf = (
	format: Format,
	clock: ClockMode | undefined,
	options: PrepareViewsOptions = {},
) =>
	render(
		"runSheet",
		prepareViews(BREAD, clock ? { clock } : {}, { ...CALENDAR, ...options }),
		format,
	) ?? "";

// A time of day in 24 hours: "13:00", "8:40", never followed by AM or PM…
// …nor the start of a 12-hour range that writes its AM or PM once ("9:40 – 10:00 PM").
const H24 =
	/\b\d{1,2}:\d{2}\b(?![\s ]?[AP]M)(?!\s[–→]\s\d{1,2}:\d{2}[\s ][AP]M)/;
const H12 = /\b\d{1,2}:\d{2}[\s ][AP]M\b/;

describe("the run sheet on the reader's clock", () => {
	for (const format of ["text", "markdown", "html", "print"] as const) {
		it(`writes every time of day in 12 hours in ${format}`, () => {
			const out = sheetOf(format, "12h");
			expect(out).toMatch(H12);
			expect(out).not.toMatch(H24);
			// The wider times never run into the text after them.
			expect(out).not.toMatch(/[AP]M[A-Za-z]/);
		});

		it(`stays in 24 hours by default in ${format}`, () => {
			const out = sheetOf(format, undefined);
			expect(out).toMatch(/\b13:00\b/);
			expect(out).not.toMatch(H12);
		});
	}

	it("follows the reader's region with auto, not the language of the words", () => {
		expect(sheetOf("text", "auto", { locale: "en-US" })).toMatch(H12);
		expect(sheetOf("text", "auto", { locale: "en-GB" })).not.toMatch(H12);
		expect(sheetOf("text", "auto", { locale: "en" })).not.toMatch(H12);
		expect(sheetOf("text", "auto", { locale: "en-US", lang: "fr" })).toMatch(
			H12,
		);
		expect(sheetOf("text", "24h", { locale: "en-US" })).not.toMatch(H12);
	});

	it("writes the serving time exactly, the visits rounded", () => {
		const out = sheetOf("text", "12h").replace(/ /g, " ");
		expect(out).toContain("1:00 PM");
		// A range writes the AM or PM the two times share once.
		expect(out).toContain("9:40 – 10:00 PM");
		expect(out).toContain("9:40 → 10:00 PM");
	});
});

describe("the serving times proposed, on the reader's clock", () => {
	const suggest = (clock: ClockMode, locale?: string) =>
		suggestServeTimes(
			prepareViews(
				BREAD,
				{ clock },
				{
					kitchen: KITCHEN,
					...(locale && { locale }),
				},
			),
			{ days: 3 },
		)!;

	it("labels and explains them in 12 hours", () => {
		const s = suggest("12h");
		expect(s.candidates.length).toBeGreaterThan(0);
		for (const c of s.candidates) {
			expect(c.label).toMatch(H12);
			expect(c.label).not.toMatch(H24);
			expect(c.title).toMatch(H12);
			expect(c.title).not.toMatch(H24);
			// The value stays local ISO: data, never words.
			expect(c.serveAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
		}
		for (const line of s.rejected) expect(line).not.toMatch(H24);
		expect(s.earliest?.label).toMatch(H12);
		expect(s.earliest?.text).toMatch(H12);
	});

	it("keeps 24 hours for a reader whose region writes them", () => {
		const s = suggest("auto", "en-GB");
		for (const c of s.candidates) expect(c.label).not.toMatch(H12);
		expect(suggest("auto", "en-US").candidates[0]?.label).toMatch(H12);
	});
});

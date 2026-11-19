/*
 * The clock a reader expects: 24 hours ("13:00") or 12 hours ("1:00 PM").
 * It is the reader's, not the recipe's: it follows the region of the reader's
 * locale ("en-US" reads 12 hours, "en-GB" and "fr-FR" 24), never the language
 * of the words, and a locale that names no region reads 24 hours.
 */

import type { ClockMode } from "../settings";

/** How the run sheet writes a time of day. */
export type HourCycle = "h12" | "h23";

/**
 * The clock of a locale: "h12" when its region writes 12 hours (`en-US`,
 * `en-CA`, `en-AU`, `en-IN`…), "h23" otherwise, and when it names no region
 * (`en`, `fr`) or cannot be read (`C`, `POSIX`). A POSIX locale
 * (`en_US.UTF-8`) is read as its BCP 47 tag. An explicit `-u-hc-` extension
 * (`en-US-u-hc-h23`) wins, as `Intl` reads it.
 */
export function hourCycleOf(locale: string | undefined): HourCycle {
	if (!locale) return "h23";
	const tag = locale.replace(/[.@].*$/, "").replace(/_/g, "-");
	try {
		// Never `maximize()`: it would make "en" the "en-US" of 12 hours.
		if (!new Intl.Locale(tag).region) return "h23";
		const { hourCycle } = new Intl.DateTimeFormat(tag, {
			hour: "numeric",
		}).resolvedOptions();
		return hourCycle === "h11" || hourCycle === "h12" ? "h12" : "h23";
	} catch {
		return "h23";
	}
}

/**
 * The clock to write with: the one the setting names, else (`auto`) the one
 * of the reader's locale. Without a locale, 24 hours: a surface that knows
 * its reader passes their locale; the renderer never guesses it.
 */
export function resolveHourCycle(
	mode: ClockMode,
	locale: string | undefined,
): HourCycle {
	if (mode === "12h") return "h12";
	if (mode === "24h") return "h23";
	return hourCycleOf(locale);
}

/**
 * The locale of the machine, from the environment a terminal or an editor
 * runs in: the first of `LC_ALL`, `LC_TIME` and `LANG` that is set, as POSIX
 * reads them (`C` and `POSIX` name no region: 24 hours). Windows sets none of
 * them: there, the runtime's locale, which follows the system's region.
 * Elsewhere, nothing set is no locale: the runtime would then say `en-US`
 * for everyone. For `resolveHourCycle` on the surfaces that run on a machine
 * (the CLI, the language server), with `process.env` and `process.platform`.
 */
export function systemLocale(
	env: Readonly<Record<string, string | undefined>>,
	platform?: string,
): string | undefined {
	const value = env.LC_ALL || env.LC_TIME || env.LANG;
	if (value) return /^(C|POSIX)([.@]|$)/.test(value) ? undefined : value;
	if (platform !== "win32") return undefined;
	return Intl.DateTimeFormat().resolvedOptions().locale || undefined;
}

/**
 * The first clock actually chosen (not `auto`), in the order of precedence a
 * surface reads them (a flag, then a project's setting, then a global one),
 * else `auto`.
 */
export function chooseClock(
	...choices: readonly (ClockMode | undefined)[]
): ClockMode {
	return choices.find((c) => c !== undefined && c !== "auto") ?? "auto";
}

/**
 * The `Intl.DateTimeFormat` options of a time of day on `cycle`: "09:05" in
 * 24 hours, "9:05 AM" in 12. For a format that also writes a day.
 */
export function clockFormatOptions(
	cycle: HourCycle = "h23",
): Intl.DateTimeFormatOptions {
	return {
		hour: cycle === "h12" ? "numeric" : "2-digit",
		minute: "2-digit",
		hourCycle: cycle,
	};
}

/**
 * "13:05" written with `cycle`: as it is in 24 hours, "1:05 PM" in 12 (the
 * marks in the words' language, "1:05 p. m." in Spanish). "24:00", the end of
 * a day, is midnight.
 */
export function formatClock(
	hhmm: string,
	cycle: HourCycle = "h23",
	lang?: string,
): string {
	if (cycle === "h23") return hhmm;
	return clockParts(hhmm, lang)
		.map((p) => p.value)
		.join("");
}

/**
 * The 12-hour formatter of each language, built once: a run sheet writes
 * dozens of times, and building an `Intl.DateTimeFormat` is the costly part.
 */
const twelveHourFormats = new Map<string, Intl.DateTimeFormat>();

function twelveHourFormat(lang: string): Intl.DateTimeFormat {
	let format = twelveHourFormats.get(lang);
	if (!format) {
		format = new Intl.DateTimeFormat(lang, {
			timeZone: "UTC",
			...clockFormatOptions("h12"),
		});
		twelveHourFormats.set(lang, format);
	}
	return format;
}

/** "13:05" in 12 hours, as `Intl` cuts it up: the hour, the minutes, the day period. */
function clockParts(hhmm: string, lang?: string): Intl.DateTimeFormatPart[] {
	const minutes =
		(Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))) % 1440;
	return twelveHourFormat(lang || "en").formatToParts(minutes * 60_000);
}

/**
 * Two times of day joined by `separator`: "13:05 – 14:00" in 24 hours. In 12
 * hours, a day period the two share is written once, as a clock range reads
 * in the United States ("1:05 – 2:00 PM", "오전 9:00 – 10:00"); across noon
 * or midnight both keep theirs ("11:30 AM – 12:10 PM").
 */
export function formatClockRange(
	from: string,
	to: string,
	separator: string,
	cycle: HourCycle = "h23",
	lang?: string,
): string {
	if (cycle === "h23") return `${from}${separator}${to}`;
	const a = clockParts(from, lang);
	const b = clockParts(to, lang);
	const period = (parts: Intl.DateTimeFormatPart[]) =>
		parts.find((p) => p.type === "dayPeriod")?.value;
	const text = (parts: Intl.DateTimeFormatPart[]) =>
		parts
			.map((p) => p.value)
			.join("")
			.trim();
	if (period(a) === undefined || period(a) !== period(b)) {
		return `${text(a)}${separator}${text(b)}`;
	}
	// The period is dropped where it touches the separator: after the first
	// time when it trails, before the second when it leads.
	const trails = a.at(-1)?.type === "dayPeriod";
	const drop = (parts: Intl.DateTimeFormatPart[]) =>
		parts.filter((p) => p.type !== "dayPeriod");
	return trails
		? `${text(drop(a))}${separator}${text(b)}`
		: `${text(a)}${separator}${text(drop(b))}`;
}

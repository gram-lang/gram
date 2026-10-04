import type { Availability, Weekday } from "@gram-lang/scheduler";
import { WEEKDAYS } from "@gram-lang/scheduler";
import { ExitCode, GramCLIError } from "../errors";

const fail = (message: string): never => {
	throw new GramCLIError(message, ExitCode.Error);
};

/**
 * Every value given to a flag that may be repeated (`--available a --available
 * b`). citty keeps the last one of a repeated flag, so these come from the raw
 * arguments, `--flag value` and `--flag=value` alike.
 */
export function collectFlag(rawArgs: string[], name: string): string[] {
	const values: string[] = [];
	const long = `--${name}`;
	for (let i = 0; i < rawArgs.length; i++) {
		const arg = rawArgs[i]!;
		if (arg === long) {
			const next = rawArgs[i + 1];
			if (next !== undefined) values.push(next);
			i++;
		} else if (arg.startsWith(`${long}=`)) {
			values.push(arg.slice(long.length + 1));
		}
	}
	return values;
}

/**
 * `--serve "2026-10-11 13:00"`: a local date and time, in the time zone of the
 * plan. A `T` instead of the space works too.
 */
export function parseServe(value: unknown): string {
	const text = String(value ?? "").trim();
	const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})$/.exec(text);
	if (!m) {
		return fail(
			`Expected --serve like "2026-10-11 13:00" (a local date and time), got "${text}".`,
		);
	}
	return `${m[1]}T${m[2]!.padStart(2, "0")}:${m[3]}`;
}

const isTimeZone = (zone: string) => {
	try {
		new Intl.DateTimeFormat("en", { timeZone: zone });
		return true;
	} catch {
		return false;
	}
};

/**
 * The time zone of a plan, from the first of: `--tz Europe/Paris`, the
 * `timezone` of the project (or global) config, this machine's. A typo is a
 * clear message naming where it came from, not a stack trace, and it is only
 * raised here: the other commands never look at the setting.
 */
export function parseTimeZone(value: unknown, configured?: string): string {
	if (typeof value === "string" && value !== "") {
		return isTimeZone(value)
			? value
			: fail(
					`Unknown time zone "${value}". Use an IANA name like Europe/Paris.`,
				);
	}
	if (configured !== undefined && configured !== "") {
		return isTimeZone(configured)
			? configured
			: fail(
					`Unknown time zone "${configured}" in the \`timezone\` setting of .gram/config.yaml. Use an IANA name like Europe/Paris, or fix it with \`gram config set timezone <zone>\`.`,
				);
	}
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

const CLOCK = /^([01]?\d|2[0-4]):([0-5]\d)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseRanges(
	text: string,
	flag: string,
): { start: string; end: string }[] {
	if (text === "none") return [];
	return text.split(",").map((part) => {
		const [start, end, ...extra] = part.split("-");
		if (
			start === undefined ||
			end === undefined ||
			extra.length > 0 ||
			!CLOCK.test(start) ||
			!CLOCK.test(end)
		) {
			return fail(
				`Expected --available ${flag} like 08:00-22:00 (several: 08:00-09:00,18:00-22:00, none for no availability), got "${part}".`,
			);
		}
		return { start, end };
	});
}

/**
 * `--available` entries, each one of:
 *   08:00-22:00            every day
 *   fri=18:00-22:00        a day of the week (mon … sun)
 *   2026-10-09=none        a date (none: not available at all)
 * Several ranges go after one key, separated by commas, and an entry may be
 * repeated to add to it. Without any entry, the cook is available all day.
 */
export function parseAvailability(entries: string[]): Availability {
	if (entries.length === 0) {
		return { daily: [{ start: "00:00", end: "24:00" }] };
	}
	const daily: { start: string; end: string }[] = [];
	const weekdays: Partial<Record<Weekday, { start: string; end: string }[]>> =
		{};
	const dates: Record<string, { start: string; end: string }[]> = {};
	for (const entry of entries) {
		const eq = entry.indexOf("=");
		if (eq === -1) {
			daily.push(...parseRanges(entry, entry));
			continue;
		}
		const key = entry.slice(0, eq).toLowerCase();
		const ranges = parseRanges(entry.slice(eq + 1), key);
		if ((WEEKDAYS as readonly string[]).includes(key)) {
			weekdays[key as Weekday] = [
				...(weekdays[key as Weekday] ?? []),
				...ranges,
			];
		} else if (DATE.test(key)) {
			dates[key] = [...(dates[key] ?? []), ...ranges];
		} else {
			fail(
				`Unknown --available key "${key}": use a day of the week (${WEEKDAYS.join(", ")}) or a date like 2026-10-09.`,
			);
		}
	}
	return {
		daily,
		...(Object.keys(weekdays).length > 0 && { weekdays }),
		...(Object.keys(dates).length > 0 && { dates }),
	};
}

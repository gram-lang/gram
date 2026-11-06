import type { Availability, TimeRange } from "./projection";
import { WEEKDAYS, type Weekday, isCalendarDate } from "./time";

/** The cook is there all day: the availability when nothing says otherwise. */
export const ALL_DAY: Availability = {
	daily: [{ start: "00:00", end: "24:00" }],
};

/**
 * Why an availability entry was refused: a `range` that is not like
 * 08:00-22:00, or a `key` that is neither a day of the week nor a date.
 */
export interface AvailabilityProblem {
	reason: "range" | "key";
	/** The whole entry. */
	entry: string;
	/** The part of it at fault: one range, or the key. */
	part: string;
}

export type AvailabilityParse =
	| { ok: true; availability: Availability }
	| ({ ok: false } & AvailabilityProblem);

const CLOCK = /^([01]?\d|2[0-4]):([0-5]\d)$/;

function parseRanges(text: string): TimeRange[] | string {
	if (text === "none") return [];
	const ranges: TimeRange[] = [];
	for (const part of text.split(",")) {
		const [start, end, ...extra] = part.split("-");
		if (
			start === undefined ||
			end === undefined ||
			extra.length > 0 ||
			!CLOCK.test(start) ||
			!CLOCK.test(end)
		) {
			return part;
		}
		ranges.push({ start, end });
	}
	return ranges;
}

/**
 * The availability that entries write, each one of:
 *   08:00-22:00            every day
 *   fri=18:00-22:00        a day of the week (mon … sun, in any case)
 *   2026-10-09=none        a date (none: not available at all)
 * Several ranges go after one key, separated by commas, and a key may come
 * back to add to it. Without any entry, the cook is available all day.
 *
 * The syntax of `gram plan --available` and of the `availability` setting of
 * a project. Data, never words: each surface says what went wrong its own way.
 */
export function parseAvailability(
	entries: readonly string[],
): AvailabilityParse {
	if (entries.length === 0) {
		return { ok: true, availability: { daily: [...ALL_DAY.daily] } };
	}
	const daily: TimeRange[] = [];
	const weekdays: Partial<Record<Weekday, TimeRange[]>> = {};
	const dates: Record<string, TimeRange[]> = {};
	for (const entry of entries) {
		const eq = entry.indexOf("=");
		const key = eq === -1 ? undefined : entry.slice(0, eq).toLowerCase();
		const ranges = parseRanges(eq === -1 ? entry : entry.slice(eq + 1));
		if (typeof ranges === "string") {
			return { ok: false, reason: "range", entry, part: ranges };
		}
		if (key === undefined) {
			daily.push(...ranges);
		} else if ((WEEKDAYS as readonly string[]).includes(key)) {
			const day = key as Weekday;
			weekdays[day] = [...(weekdays[day] ?? []), ...ranges];
		} else if (isCalendarDate(key)) {
			dates[key] = [...(dates[key] ?? []), ...ranges];
		} else {
			return { ok: false, reason: "key", entry, part: entry.slice(0, eq) };
		}
	}
	return {
		ok: true,
		availability: {
			daily,
			...(Object.keys(weekdays).length > 0 && { weekdays }),
			...(Object.keys(dates).length > 0 && { dates }),
		},
	};
}

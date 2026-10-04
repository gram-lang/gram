import type { Availability, TimeRange } from "./projection";
import {
	type Weekday,
	addDays,
	localDateTime,
	parseClock,
	toLocal,
} from "./time";

/** A span of time, in minutes since the epoch. */
export interface Interval {
	start: number;
	end: number;
}

const rangesOn = (
	availability: Availability,
	date: string,
	weekday: Weekday,
): TimeRange[] =>
	availability.dates?.[date] ??
	availability.weekdays?.[weekday] ??
	availability.daily;

/** Sorted, with overlapping and touching spans joined. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
	const sorted = intervals
		.filter((i) => i.end > i.start)
		.sort((a, b) => a.start - b.start || a.end - b.end);
	const merged: Interval[] = [];
	for (const i of sorted) {
		const last = merged.at(-1);
		if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
		else merged.push({ ...i });
	}
	return merged;
}

/**
 * The spans the cook is available in, between `from` and `to` (a day more on
 * each side, so a stretch of work that reaches past the plan is judged too).
 * Every range is read as local time, so a day of 23 or 25 hours is what it is.
 */
export function availableIntervals(
	availability: Availability,
	timeZone: string,
	from: number,
	to: number,
): Interval[] {
	const first = addDays(toLocal(from, timeZone).date, -1);
	const last = addDays(toLocal(to, timeZone).date, 1);
	const intervals: Interval[] = [];
	for (let date = first; date <= last; date = addDays(date, 1)) {
		const weekday = toLocal(
			localDateTime(date, 12 * 60, timeZone),
			timeZone,
		).weekday;
		for (const range of rangesOn(availability, date, weekday)) {
			const start = parseClock(range.start);
			const end = parseClock(range.end);
			if (end === start) continue;
			intervals.push({
				start: localDateTime(date, start, timeZone),
				end:
					end > start
						? localDateTime(date, end, timeZone)
						: localDateTime(addDays(date, 1), end, timeZone),
			});
		}
	}
	return mergeIntervals(intervals);
}

/** What lies between the intervals, within `[from, to]`. */
export function gapsBetween(
	intervals: Interval[],
	from: number,
	to: number,
): Interval[] {
	const gaps: Interval[] = [];
	let cursor = from;
	for (const i of intervals) {
		if (i.end <= cursor) continue;
		if (i.start >= to) break;
		if (i.start > cursor) gaps.push({ start: cursor, end: i.start });
		cursor = Math.max(cursor, i.end);
	}
	if (cursor < to) gaps.push({ start: cursor, end: to });
	return gaps;
}

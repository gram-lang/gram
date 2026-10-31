import type { ScheduleBlock, ScheduleDay, SchedulingDiagnostic } from "./types";

export const MINUTES_PER_DAY = 1440;

/**
 * Sections grouped by working day, the furthest day first and each group in
 * source order. A recipe without any anchor of a day or more is a single group.
 */
export function groupsFromDays(days: number[]): number[][] {
	const byDay = new Map<number, number[]>();
	days.forEach((day, section) => {
		const group = byDay.get(day);
		if (group) group.push(section);
		else byDay.set(day, [section]);
	});
	return [...byDay.entries()]
		.sort(([a], [b]) => b - a)
		.map(([, sections]) => sections);
}

/** The working days of a recipe and the sections of each. */
export interface DayPlan {
	groups: number[][];
	days: number[];
}

/** One working day per group of sections, from the sections' days. */
export function dayPlan(days: number[]): DayPlan {
	return { groups: groupsFromDays(days), days };
}

/** The whole recipe as one working day, on its furthest day (`upfront`). */
export function singleDayPlan(days: number[]): DayPlan {
	const furthest = Math.max(0, ...days);
	return {
		groups: [days.map((_, i) => i)],
		days: days.map(() => furthest),
	};
}

/**
 * The working days of a laid-out timeline: one per group, bounded by its active
 * work (`step` and `prep` blocks; a passive wait doesn't keep the day going).
 * A group with no active block has no working day.
 */
export function daysOf(
	blocks: ScheduleBlock[],
	groups: number[][],
	days: number[],
): ScheduleDay[] {
	const result: ScheduleDay[] = [];
	for (const sections of groups) {
		let start = Infinity;
		let end = -Infinity;
		for (const b of blocks) {
			if (b.kind === "passive" || !sections.includes(b.section)) continue;
			start = Math.min(start, b.start);
			end = Math.max(end, b.end);
		}
		if (start === Infinity) continue;
		result.push({ day: days[sections[0]!]!, start, end, sections });
	}
	return result;
}

/**
 * Working days whose active work starts before their 24 h window opens: the
 * work of day `d` is meant to happen within the `d + 1` days that end with
 * the recipe, so its work can't start before `end - (d + 1) x 24 h`. A passive
 * rest running through the night doesn't count, only the cook's own work does.
 * Conservative on purpose: the calendar day the work really falls on is only
 * known once a serving time is chosen.
 */
export function dayOverflows(
	workingDays: ScheduleDay[],
	blocks: ScheduleBlock[],
	totalTime: number,
): Extract<SchedulingDiagnostic, { code: "DAY_OVERFLOW" }>[] {
	const overflows: Extract<SchedulingDiagnostic, { code: "DAY_OVERFLOW" }>[] =
		[];
	for (const workingDay of workingDays) {
		const opens = totalTime - (workingDay.day + 1) * MINUTES_PER_DAY;
		if (workingDay.start >= opens) continue;
		const first = blocks.find(
			(b) =>
				b.kind !== "passive" &&
				b.start === workingDay.start &&
				workingDay.sections.includes(b.section),
		);
		overflows.push({
			code: "DAY_OVERFLOW",
			section: first?.section ?? workingDay.sections[0]!,
			day: workingDay.day,
			overflowMinutes: opens - workingDay.start,
		});
	}
	return overflows;
}

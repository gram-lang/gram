import type { ScheduleBlock, ScheduleSession } from "./types";

const MINUTES_PER_DAY = 1440;

/**
 * The working day of every section, in one backward pass: 0 is the day itself,
 * 1 the day before (`~{-1d}`), and so on. A section anchored at least a day
 * back sits on that day; any other section sits on the day of the next anchor
 * (the furthest one among itself and the sections after it, like the chaining
 * in alap.ts where every anchor is a deadline). Sections after the last anchor
 * fall on day 0.
 */
export function sessionDays(
	sections: { retro_planning?: { minutes?: number } | null }[],
): number[] {
	const days: number[] = new Array(sections.length).fill(0);
	let running = 0;
	for (let i = sections.length - 1; i >= 0; i--) {
		const minutes = sections[i]!.retro_planning?.minutes;
		if (minutes !== undefined) {
			running = Math.max(
				running,
				Math.floor(Math.abs(minutes) / MINUTES_PER_DAY),
			);
		}
		days[i] = running;
	}
	return days;
}

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
export interface SessionPlan {
	groups: number[][];
	days: number[];
}

/** One session per working day, from the sections' anchors. */
export function sessionPlan(
	sections: Parameters<typeof sessionDays>[0],
): SessionPlan {
	const days = sessionDays(sections);
	return { groups: groupsFromDays(days), days };
}

/** The whole recipe as one session, on its furthest day (`upfront`). */
export function singleSessionPlan(
	sections: Parameters<typeof sessionDays>[0],
): SessionPlan {
	const furthest = Math.max(0, ...sessionDays(sections));
	return {
		groups: [sections.map((_, i) => i)],
		days: sections.map(() => furthest),
	};
}

/**
 * The sessions of a laid-out timeline: one per group, bounded by its active
 * work (`step` and `prep` blocks; a passive wait doesn't keep the day going).
 * A group with no active block has no session.
 */
export function sessionsOf(
	blocks: ScheduleBlock[],
	groups: number[][],
	days: number[],
): ScheduleSession[] {
	const sessions: ScheduleSession[] = [];
	for (const sections of groups) {
		let start = Infinity;
		let end = -Infinity;
		for (const b of blocks) {
			if (b.kind === "passive" || !sections.includes(b.section)) continue;
			start = Math.min(start, b.start);
			end = Math.max(end, b.end);
		}
		if (start === Infinity) continue;
		sessions.push({ day: days[sections[0]!]!, start, end, sections });
	}
	return sessions;
}

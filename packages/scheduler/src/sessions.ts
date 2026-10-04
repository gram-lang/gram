import type {
	ScheduleBlock,
	ScheduleSession,
	SchedulingDiagnostic,
} from "./types";

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
export interface SessionPlan {
	groups: number[][];
	days: number[];
}

/** One session per working day, from the sections' days. */
export function sessionPlan(days: number[]): SessionPlan {
	return { groups: groupsFromDays(days), days };
}

/** The whole recipe as one session, on its furthest day (`upfront`). */
export function singleSessionPlan(days: number[]): SessionPlan {
	const furthest = Math.max(0, ...days);
	return {
		groups: [days.map((_, i) => i)],
		days: days.map(() => furthest),
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

/**
 * Sessions whose active work starts before their 24 h window opens: the
 * session of day `d` is meant to happen within the `d + 1` days that end with
 * the recipe, so its work can't start before `end - (d + 1) x 24 h`. A passive
 * rest running through the night doesn't count, only the cook's own work does.
 * Conservative on purpose: the calendar day the work really falls on is only
 * known once a serving time is chosen.
 */
export function sessionOverflows(
	sessions: ScheduleSession[],
	blocks: ScheduleBlock[],
	totalTime: number,
): Extract<SchedulingDiagnostic, { code: "SESSION_OVERFLOW" }>[] {
	const overflows: Extract<
		SchedulingDiagnostic,
		{ code: "SESSION_OVERFLOW" }
	>[] = [];
	for (const session of sessions) {
		const opens = totalTime - (session.day + 1) * MINUTES_PER_DAY;
		if (session.start >= opens) continue;
		const first = blocks.find(
			(b) =>
				b.kind !== "passive" &&
				b.start === session.start &&
				session.sections.includes(b.section),
		);
		overflows.push({
			code: "SESSION_OVERFLOW",
			section: first?.section ?? session.sections[0]!,
			day: session.day,
			overflowMinutes: opens - session.start,
		});
	}
	return overflows;
}

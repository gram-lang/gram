import type { Schedule } from "./types";

/**
 * The two complete timelines a compiled recipe carries: mise en place right
 * before each section, or all of it at the start. Every package that lets the
 * reader pick one (renderer, CLI, language server, playground) reads its
 * choices, default and validation from here.
 */
export const SCHEDULE_MODES = ["perSection", "upfront"] as const;

export type ScheduleMode = (typeof SCHEDULE_MODES)[number];

/** Preparation right before each section, unless the reader picks otherwise. */
export const DEFAULT_SCHEDULE_MODE: ScheduleMode = "perSection";

/** Narrows untrusted input (a saved choice, a setting) to a known mode. */
export const isScheduleMode = (value: unknown): value is ScheduleMode =>
	(SCHEDULE_MODES as readonly unknown[]).includes(value);

/**
 * The timeline for `mode` (the default one when none is given). Undefined only
 * for JSON that carries no `schedules` (e.g. produced by an older kitchen), so
 * callers can degrade instead of crashing.
 */
export function scheduleFor(
	compiled: { schedules?: Partial<Record<ScheduleMode, Schedule>> },
	mode: ScheduleMode = DEFAULT_SCHEDULE_MODE,
): Schedule | undefined {
	return compiled.schedules?.[mode];
}

/**
 * Total and idle time, in minutes, of the timeline for `mode` (the default one
 * when none is given). JSON compiled before 1.4.0 carries no `schedules`: it
 * falls back on the deprecated `metrics.totalTime` / `metrics.idleTime` it does
 * have, and on 0 when even those are missing. Every reader of these two times
 * goes through here, so the fallback is dropped in one place with the
 * deprecated fields in 2.0.0.
 */
export function scheduleTimes(
	compiled: {
		schedules?: Partial<Record<ScheduleMode, Schedule>>;
		metrics?: { totalTime?: number; idleTime?: number };
	},
	mode?: ScheduleMode,
): { totalTime: number; idleTime: number } {
	const schedule = scheduleFor(compiled, mode);
	return {
		totalTime: schedule?.totalTime ?? compiled.metrics?.totalTime ?? 0,
		idleTime: schedule?.idleTime ?? compiled.metrics?.idleTime ?? 0,
	};
}

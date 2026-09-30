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

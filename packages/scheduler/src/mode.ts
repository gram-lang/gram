/**
 * The complete timelines a compiled recipe carries: mise en place right
 * before each section, all of it at the start, or at the start of each working
 * day. Every package that lets the reader pick one (renderer, CLI, language
 * server, playground) reads its choices, default and validation from here.
 */
export const SCHEDULE_MODES = ["perSection", "upfront", "perSession"] as const;

export type ScheduleMode = (typeof SCHEDULE_MODES)[number];

/** Preparation right before each section, unless the reader picks otherwise. */
export const DEFAULT_SCHEDULE_MODE: ScheduleMode = "perSection";

/** Narrows untrusted input (a saved choice, a setting) to a known mode. */
export const isScheduleMode = (value: unknown): value is ScheduleMode =>
	(SCHEDULE_MODES as readonly unknown[]).includes(value);

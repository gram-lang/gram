import type { MiseEnPlaceItem } from "./types";

/**
 * How long a task lasts, in minutes. `min`/`max` are there only for a passive
 * rest written as a range (`~_{12-24h}`), so a consumer can tell "ready from
 * 12 h, still good at 24 h" from a fixed 12 h.
 *
 * `nominal` is what the default timeline plans with: the shortest figure for a
 * passive rest (the `rests: "shortest"` default), the longest for an active
 * timer written as a range (`~{20-25min}` is cooking uncertainty, not slack, so
 * dinner is never late), the value itself otherwise.
 */
export interface TaskDuration {
	nominal: number;
	min?: number;
	max?: number;
}

/**
 * What it takes to get a section (or one intermediate it uses) ready: the
 * gathering and the preparations of its ingredients and cookware.
 *
 * Every section has a `prep` task for what is gathered or prepared from raw
 * ingredients, plus one per intermediate it consumes (`&dough`). The latter
 * can't start before the intermediate exists, which is what `after` says: the
 * step that makes it, or nothing when the graph can't tell (planned as late as
 * the section itself).
 */
export interface PrepTask {
	id: string;
	kind: "prep";
	section: number;
	/** Id of the intermediate it prepares, absent for the raw part of a section. */
	intermediate?: string;
	duration: TaskDuration;
	items: MiseEnPlaceItem[];
	after: string[];
}

/** One step of a section: the cook's hands-on time. */
export interface StepTask {
	id: string;
	kind: "step";
	section: number;
	/** Index in the section's steps, comments included. */
	step: number;
	duration: TaskDuration;
	/** Intermediates the step finishes, as written in the recipe. */
	produces?: string[];
	/** Intermediates the step uses, as written in the recipe. */
	consumes?: string[];
	/** The previous step of the section, and the steps that make what it consumes. */
	after: string[];
}

/** A passive timer of a step: the cook is free while it runs. */
export interface TimerTask {
	id: string;
	kind: "passive";
	section: number;
	step: number;
	/** Present only for a named track (`~_oven{}`): two timers on one track can't overlap. */
	track?: string;
	/** Minutes after the step's start at which the timer starts. */
	offset: number;
	duration: TaskDuration;
	after: string[];
}

export type Task = PrepTask | StepTask | TimerTask;

export interface TaskGraphSection {
	/**
	 * The working day: 0 is the day itself, 1 the day before (`~{-1d}`). Only an
	 * anchor in days opens a day; one in hours (`~{-36h}`) never does.
	 */
	day: number;
	/** The anchor, in minutes before the end of the recipe. */
	deadline?: number;
	/** The intermediate the section as a whole makes (`## Dough ->&dough`). */
	intermediate?: string;
}

/**
 * What the scheduler needs to lay a recipe out, and nothing else: independent
 * of any option (mise en place mode, choice of rests) so every combination is
 * computed from it, without compiling again.
 */
export interface TaskGraph {
	/** Sections in order, then steps, `prep` first in each section. */
	tasks: Task[];
	/** Parallel to the recipe's sections. */
	sections: TaskGraphSection[];
}

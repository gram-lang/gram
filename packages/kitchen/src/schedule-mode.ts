import {
	DEFAULT_MISE_EN_PLACE_MODE,
	DEFAULT_REST_CHOICE,
	type MiseEnPlaceMode,
	type RestChoice,
	type TaskGraph,
	layout,
} from "@gram-lang/scheduler";
import type { Schedule } from "./types";

// The choices themselves, and the scheduler that lays a recipe out, live in
// `@gram-lang/scheduler`; every package that offers them reads them from here.
export {
	DEFAULT_MISE_EN_PLACE_MODE,
	DEFAULT_REST_CHOICE,
	MISE_EN_PLACE_MODES,
	REST_CHOICES,
	type LayoutOptions,
	type MiseEnPlaceMode,
	type RestChoice,
	isMiseEnPlaceMode,
	isRestChoice,
	layout,
} from "@gram-lang/scheduler";

/** Timelines already laid out from a compiled recipe, by the choices that made them. */
const laidOut = new WeakMap<TaskGraph, Map<string, Schedule>>();

/**
 * The timeline for a choice of mise en place and rests (the defaults when none
 * is given). The default one is the `schedule` the compiled recipe carries; the
 * others are laid out from its `tasks` once and kept. Undefined only for JSON
 * that carries no `tasks` (e.g. produced by an older kitchen), so callers can
 * degrade instead of crashing.
 */
export function scheduleFor(
	compiled: { schedule?: Schedule; tasks?: TaskGraph },
	mode: MiseEnPlaceMode = DEFAULT_MISE_EN_PLACE_MODE,
	rests: RestChoice = DEFAULT_REST_CHOICE,
): Schedule | undefined {
	if (
		compiled.schedule &&
		mode === compiled.schedule.miseEnPlace &&
		rests === compiled.schedule.rests
	) {
		return compiled.schedule;
	}
	const { tasks } = compiled;
	if (!tasks) return undefined;
	const byChoice = laidOut.get(tasks) ?? new Map<string, Schedule>();
	laidOut.set(tasks, byChoice);
	const key = `${mode}/${rests}`;
	let schedule = byChoice.get(key);
	if (!schedule) {
		schedule = layout(tasks, { miseEnPlace: mode, rests }).schedule;
		byChoice.set(key, schedule);
	}
	return schedule;
}

/**
 * Total and idle time, in minutes, of the timeline for a choice (the default
 * one when none is given). JSON compiled before 1.4.0 carries no `tasks`: it
 * falls back on the deprecated `metrics.totalTime` / `metrics.idleTime` it does
 * have, and on 0 when even those are missing. Every reader of these two times
 * goes through here, so the fallback is dropped in one place with the
 * deprecated fields in 2.0.0.
 */
export function scheduleTimes(
	compiled: {
		schedule?: Schedule;
		tasks?: TaskGraph;
		metrics?: { totalTime?: number; idleTime?: number };
	},
	mode?: MiseEnPlaceMode,
	rests?: RestChoice,
): { totalTime: number; idleTime: number } {
	const schedule = scheduleFor(compiled, mode, rests);
	// @remove-in: 2.0.0 [kitchen-legacy-schedule-fallback]
	return {
		totalTime: schedule?.totalTime ?? compiled.metrics?.totalTime ?? 0,
		idleTime: schedule?.idleTime ?? compiled.metrics?.idleTime ?? 0,
	};
}

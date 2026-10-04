import { DEFAULT_SCHEDULE_MODE, type ScheduleMode } from "@gram-lang/scheduler";
import type { Schedule } from "./types";

// The modes themselves live in the scheduler, which lays the timelines out.
export {
	DEFAULT_SCHEDULE_MODE,
	SCHEDULE_MODES,
	type ScheduleMode,
	isScheduleMode,
} from "@gram-lang/scheduler";

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
	// @remove-in: 2.0.0 [kitchen-legacy-schedule-fallback]
	return {
		totalTime: schedule?.totalTime ?? compiled.metrics?.totalTime ?? 0,
		idleTime: schedule?.idleTime ?? compiled.metrics?.idleTime ?? 0,
	};
}

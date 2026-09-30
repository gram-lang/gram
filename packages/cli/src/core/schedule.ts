import type { CompilationResult } from "@gram-lang/kitchen";
import type { ScheduleMode } from "@gram-lang/renderer";

/**
 * The compiled result's timeline for a mise en place mode. Undefined only for
 * JSON that carries no `schedules`, so callers degrade instead of crashing.
 */
export function scheduleOf(
	compiled: Pick<CompilationResult, "schedules">,
	mode: ScheduleMode,
) {
	return compiled.schedules?.[mode];
}

/**
 * Duration, in minutes, of every background timer (`~_name{}`) that runs
 * during one step, in the order they start. `step` is the step's index in
 * `sections[section].steps`, comments included — the same index the schedule
 * blocks use. A timer's length doesn't depend on the mise en place mode.
 */
export function passiveTimers(
	compiled: Pick<CompilationResult, "schedules">,
	section: number,
	step: number,
): Array<{ name?: string; duration: number }> {
	const blocks = scheduleOf(compiled, "perSection")?.blocks ?? [];
	const timers: Array<{ name?: string; duration: number }> = [];
	for (const b of blocks) {
		if (b.kind !== "passive" || b.section !== section || b.step !== step) {
			continue;
		}
		timers.push({ name: b.track, duration: b.end - b.start });
	}
	return timers;
}

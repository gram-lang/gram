import type { SectionAST } from "@gram-lang/parser";
import type { ProcessedSection } from "../types";
import { WarningCode, pushWarning, type Warning } from "../warnings";
import type { ScheduledPassiveTask, StepSchedule } from "./types";

/**
 * Resolves the actual (as opposed to theoretical) start/end of every passive
 * task, in chronological order. Two passive tasks sharing a name (a "named
 * track", e.g. two steps both using `~_oven{...}`) can't physically overlap
 * — the second is pushed later than its theoretical start if the track is
 * still busy, and a `TRACK_CONTENTION` warning is raised when that happens.
 *
 * scheduleALAP (alap.ts) already treats same-track usage as an implicit
 * dependency, so the ordinary case — several steps chaining one physical
 * resource back-to-back, in textual order — has matching theoretical and
 * actual times and never warns here. A delay can still surface when some
 * *other* dependency reorders a track's users relative to their textual
 * order, which is a genuine, unforeseen conflict worth flagging.
 *
 * Reads `schedules` (must already have `.ls` set by scheduleALAP) and
 * returns a new array; does not mutate its input.
 */
export function serializeTracks(
	schedules: StepSchedule[],
	sections: ProcessedSection[],
	sectionASTs: SectionAST[],
	warnings: Warning[],
): ScheduledPassiveTask[] {
	const backgroundTrackCursors = new Map<string, number>();

	const allPassiveTasks: ScheduledPassiveTask[] = [];

	for (const sched of schedules) {
		if (sched.isComment) continue;
		for (const task of sched.passiveTasks) {
			allPassiveTasks.push({
				sched,
				task,
				theoreticalStart: sched.ls + task.localOffset,
				actualStart: 0,
				actualEnd: 0,
			});
		}
	}

	allPassiveTasks.sort((a, b) => a.theoreticalStart - b.theoreticalStart);

	for (const entry of allPassiveTasks) {
		let actualStart = entry.theoreticalStart;
		if (entry.task.isNamed) {
			const cursor = backgroundTrackCursors.get(entry.task.name) ?? -Infinity;
			actualStart = Math.max(actualStart, cursor);
		}

		entry.actualStart = actualStart;
		entry.actualEnd = actualStart + entry.task.duration;

		if (entry.task.isNamed) {
			backgroundTrackCursors.set(entry.task.name, entry.actualEnd);
		}

		const theoreticalEnd = entry.theoreticalStart + entry.task.duration;
		const delay = entry.actualEnd - theoreticalEnd;

		if (delay > 0) {
			pushWarning(warnings, WarningCode.TRACK_CONTENTION, {
				trackName: entry.task.name,
				delay: delay,
				item: `Step in section '${sections[entry.sched.sectionIndex]!.title || "unnamed"}'`,
				loc: sectionASTs[entry.sched.sectionIndex]?.loc,
			});
		}
	}

	return allPassiveTasks;
}

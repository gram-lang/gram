import type {
	ProcessedSection,
	ProcessedStep,
	TimeBreakdownItem,
} from "../types";
import { addToBreakdown } from "../utils";
import type { ScheduledPassiveTask, StepSchedule } from "./types";

export interface ScheduleMetrics {
	idleTime: number;
	activeTime: number;
	activeBreakdown: TimeBreakdownItem[];
	totalBreakdown: TimeBreakdownItem[];
}

/**
 * Shifts every `ls`/`lf`/passive-task start so the earliest one lands at 0
 * (ALAP scheduling naturally produces negative offsets from an arbitrary
 * T-zero), writes the final `timings.start`/`timings.end` onto each step's
 * output object, and computes the timing breakdowns / idle time.
 *
 * This is the only phase that mutates the compiled output's `timings` —
 * scheduleALAP and serializeTracks only compute `ls`/`lf`/actualStart on the
 * internal StepSchedule/ScheduledPassiveTask records.
 */
export function rebaseAndCommit(
	schedules: StepSchedule[],
	passiveTasks: ScheduledPassiveTask[],
	sections: ProcessedSection[],
	globalActiveTime: number,
): ScheduleMetrics {
	let globalMinStart = 0;
	for (const sched of schedules) {
		if (!sched.isComment) globalMinStart = Math.min(globalMinStart, sched.ls);
	}
	for (const entry of passiveTasks) {
		globalMinStart = Math.min(globalMinStart, entry.actualStart);
	}

	const rebaseOffset = Math.abs(globalMinStart);

	const activeBreakdown: TimeBreakdownItem[] = [];
	const totalContributions: Array<{
		label: string;
		start: number;
		end: number;
	}> = [];

	for (const sched of schedules) {
		if (sched.isComment) continue;

		const stepObj = sched.stepObj as ProcessedStep;
		const rebasedLs = sched.ls + rebaseOffset;
		const rebasedLf = sched.lf + rebaseOffset;

		stepObj.timings.start = rebasedLs;
		stepObj.timings.end = rebasedLf;
		stepObj.timings.activeDuration = sched.localActiveTime;

		if (sched.localActiveTime > 0) {
			const sectionTitle = sections[sched.sectionIndex]!.title || "unnamed";
			const activeLabel = `section_active:${sectionTitle}`;
			addToBreakdown(activeBreakdown, activeLabel, sched.localActiveTime);
			totalContributions.push({
				label: activeLabel,
				start: rebasedLs,
				end: rebasedLf,
			});
		}
	}

	for (const entry of passiveTasks) {
		const stepObj = entry.sched.stepObj as ProcessedStep;
		const rebasedStart = entry.actualStart + rebaseOffset;
		const rebasedEnd = entry.actualEnd + rebaseOffset;

		stepObj.backgroundTasks.push({
			name: entry.task.sourceName,
			duration: entry.task.duration,
			startOffset: rebasedStart - stepObj.timings.start,
		});

		const timerLabel = entry.task.isNamed
			? `timer_named:${entry.task.name}`
			: `timer_passive`;
		totalContributions.push({
			label: timerLabel,
			start: rebasedStart,
			end: rebasedEnd,
		});
	}

	totalContributions.sort((a, b) => a.start - b.start || a.end - b.end);
	const totalBreakdown: TimeBreakdownItem[] = [];
	let maxEnd = 0;

	for (const { label, start, end } of totalContributions) {
		const effectiveStart = Math.max(start, maxEnd);
		const added = end - effectiveStart;
		if (added > 0) {
			addToBreakdown(totalBreakdown, label, added);
			maxEnd = Math.max(maxEnd, end);
		}
	}

	const workflowDuration = maxEnd;
	const idleTime = workflowDuration - globalActiveTime;

	return {
		idleTime,
		activeTime: globalActiveTime,
		activeBreakdown,
		totalBreakdown,
	};
}

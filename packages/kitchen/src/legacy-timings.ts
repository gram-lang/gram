import type { StepSchedule, Timeline } from "@gram-lang/scheduler";
import type {
	ProcessedSection,
	ProcessedStep,
	TimeBreakdownItem,
} from "./types";

export interface ScheduleMetrics {
	idleTime: number;
	activeTime: number;
	activeBreakdown: TimeBreakdownItem[];
	totalBreakdown: TimeBreakdownItem[];
}

/**
 * Writes a timeline onto the compiled output: `timings.start`/`end`/
 * `activeDuration` on each step and `backgroundTasks` on each step with a
 * passive task. This is the only phase that mutates the compiled output's
 * `timings` — scheduleALAP and serializeTracks only compute `ls`/`lf`/
 * actualStart on the internal StepSchedule/ScheduledPassiveTask records.
 */
export function commitTimeline(
	timeline: Timeline,
	sections: ProcessedSection[],
	globalActiveTime: number,
): ScheduleMetrics {
	const stepOf = (sched: StepSchedule) =>
		sections[sched.sectionIndex]!.steps[
			sched.stepIndex as number
		] as ProcessedStep;

	// @remove-in: 2.0.0 [kitchen-step-timings]
	for (const { sched, start, end } of timeline.steps) {
		const stepObj = stepOf(sched);
		stepObj.timings.start = start;
		stepObj.timings.end = end;
		stepObj.timings.activeDuration = sched.localActiveTime;
	}

	// @remove-in: 2.0.0 [kitchen-step-background-tasks]
	for (const { entry, start } of timeline.passives) {
		const stepObj = stepOf(entry.sched);
		stepObj.backgroundTasks.push({
			name: entry.task.sourceName,
			duration: entry.task.duration,
			startOffset: start - stepObj.timings.start,
		});
	}

	return {
		idleTime: timeline.workflowDuration - globalActiveTime,
		activeTime: globalActiveTime,
		activeBreakdown: timeline.activeBreakdown,
		totalBreakdown: timeline.totalBreakdown,
	};
}

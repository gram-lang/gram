import {
	type SchedulingDiagnostic,
	type StepSchedule,
	type Timeline,
	computeTimeline,
	scheduleALAP,
	serializeTracks,
} from "@gram-lang/scheduler";
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

/**
 * The legacy pass, whole: ALAP backward pass, named-track re-serialization,
 * timeline, then commit onto the steps. It only feeds the deprecated fields
 * (`timings`, `backgroundTasks`, `metrics`); the default timeline comes from
 * the task graph and never reads what it writes.
 *
 * Each step's `timings` and `backgroundTasks` start again from nothing, so a
 * recalculation (scaling, analysis) never adds its passive tasks to the
 * previous ones. Returns the metrics and the scheduling problems found; the
 * caller decides whether they become warnings (`compile`) or not (a
 * recalculation describes the same recipe).
 */
export function planLegacy(
	sections: ProcessedSection[],
	schedules: StepSchedule[],
): { metrics: ScheduleMetrics; diagnostics: SchedulingDiagnostic[] } {
	let activeTime = 0;
	for (const sched of schedules) {
		if (sched.isComment) continue;
		const stepObj = sections[sched.sectionIndex]!.steps[
			sched.stepIndex as number
		] as ProcessedStep;
		stepObj.timings = {
			start: 0,
			end: 0,
			activeDuration: sched.localActiveTime,
		};
		stepObj.backgroundTasks = [];
		activeTime += sched.localActiveTime;
	}

	const diagnostics: SchedulingDiagnostic[] = [];
	scheduleALAP(schedules, sections, diagnostics);
	const passives = serializeTracks(schedules, diagnostics);
	const timeline = computeTimeline(schedules, passives, sections);
	return {
		metrics: commitTimeline(timeline, sections, activeTime),
		diagnostics,
	};
}

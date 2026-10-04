import type {
	ProcessedSection,
	ProcessedStep,
	ScheduleBlock,
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
 * The rebased, side-effect-free result of laying out a set of schedules:
 * every timing shifted so the earliest lands at 0, ready to be committed onto
 * the compiled output (`commitTimeline`) or read as-is (the per-section pass).
 */
export interface Timeline {
	blocks: ScheduleBlock[];
	steps: Array<{ sched: StepSchedule; start: number; end: number }>;
	passives: Array<{ entry: ScheduledPassiveTask; start: number; end: number }>;
	workflowDuration: number;
	activeBreakdown: TimeBreakdownItem[];
	totalBreakdown: TimeBreakdownItem[];
}

const KIND_ORDER = { prep: 0, step: 1, passive: 2 } as const;

/** Deterministic order: by start, then end, then kind, then position in the recipe. */
function sortBlocks(blocks: ScheduleBlock[]): ScheduleBlock[] {
	return blocks.sort(
		(a, b) =>
			a.start - b.start ||
			a.end - b.end ||
			KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
			a.section - b.section ||
			("step" in a ? a.step : -1) - ("step" in b ? b.step : -1),
	);
}

/**
 * Shifts every `ls`/`lf`/passive-task start so the earliest one lands at 0
 * (ALAP scheduling naturally produces negative offsets from an arbitrary
 * T-zero) and computes the blocks and timing breakdowns.
 *
 * Pure: reads `schedules`/`passiveTasks`, writes nothing. A synthetic `isPrep`
 * schedule becomes a `prep` block and is left out of the active breakdown.
 */
export function computeTimeline(
	schedules: StepSchedule[],
	passiveTasks: ScheduledPassiveTask[],
	sections: ProcessedSection[],
): Timeline {
	let globalMinStart = 0;
	for (const sched of schedules) {
		if (!sched.isComment) globalMinStart = Math.min(globalMinStart, sched.ls);
	}
	for (const entry of passiveTasks) {
		globalMinStart = Math.min(globalMinStart, entry.actualStart);
	}

	const rebaseOffset = Math.abs(globalMinStart);

	const blocks: ScheduleBlock[] = [];
	const steps: Timeline["steps"] = [];
	const passives: Timeline["passives"] = [];
	const activeBreakdown: TimeBreakdownItem[] = [];
	const totalContributions: Array<{
		label: string;
		start: number;
		end: number;
	}> = [];

	for (const sched of schedules) {
		if (sched.isComment) continue;

		const rebasedLs = sched.ls + rebaseOffset;
		const rebasedLf = sched.lf + rebaseOffset;

		if (sched.isPrep) {
			blocks.push({
				kind: "prep",
				section: sched.prepFor ?? sched.sectionIndex,
				start: rebasedLs,
				end: rebasedLf,
				...(sched.deferred && { deferred: true as const }),
				...(sched.items && { items: sched.items }),
			});
			continue;
		}

		steps.push({ sched, start: rebasedLs, end: rebasedLf });
		blocks.push({
			kind: "step",
			section: sched.sectionIndex,
			step: sections[sched.sectionIndex]!.steps.indexOf(
				sched.stepObj as ProcessedStep,
			),
			start: rebasedLs,
			end: rebasedLf,
		});

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
		const rebasedStart = entry.actualStart + rebaseOffset;
		const rebasedEnd = entry.actualEnd + rebaseOffset;
		passives.push({ entry, start: rebasedStart, end: rebasedEnd });

		const passiveBlock: ScheduleBlock = {
			kind: "passive",
			section: entry.sched.sectionIndex,
			step: sections[entry.sched.sectionIndex]!.steps.indexOf(
				entry.sched.stepObj as ProcessedStep,
			),
			start: rebasedStart,
			end: rebasedEnd,
		};
		// Anonymous timers carry no track: keep the key absent rather than undefined.
		if (entry.task.isNamed) passiveBlock.track = entry.task.name;
		blocks.push(passiveBlock);

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

	return {
		blocks: sortBlocks(blocks),
		steps,
		passives,
		workflowDuration: maxEnd,
		activeBreakdown,
		totalBreakdown,
	};
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
	globalActiveTime: number,
): ScheduleMetrics {
	// @remove-in: 2.0.0 [kitchen-step-timings]
	for (const { sched, start, end } of timeline.steps) {
		const stepObj = sched.stepObj as ProcessedStep;
		stepObj.timings.start = start;
		stepObj.timings.end = end;
		stepObj.timings.activeDuration = sched.localActiveTime;
	}

	// @remove-in: 2.0.0 [kitchen-step-background-tasks]
	for (const { entry, start } of timeline.passives) {
		const stepObj = entry.sched.stepObj as ProcessedStep;
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

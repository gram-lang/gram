import { addToBreakdown } from "./breakdown";
import type {
	ScheduleBlock,
	ScheduledPassiveTask,
	SchedulingSection,
	StepSchedule,
	TimeBreakdownItem,
} from "./types";

/**
 * The rebased, side-effect-free result of laying out a set of schedules:
 * every timing shifted so the earliest lands at 0, ready to be committed onto
 * the compiled output by the caller or read as-is (the per-section pass).
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
	sections: SchedulingSection[],
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
			step: sched.stepIndex as number,
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
			step: entry.sched.stepIndex as number,
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

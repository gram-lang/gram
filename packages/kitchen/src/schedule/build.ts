import type { SectionAST } from "@gram-lang/parser";
import type {
	ProcessedSection,
	Schedule,
	ScheduleBlock,
	SectionMiseEnPlace,
} from "../types";
import type { Warning } from "../warnings";
import { scheduleALAP } from "./alap";
import { computeTimeline, sortBlocks, type Timeline } from "./rebase";
import { serializeTracks } from "./tracks";
import type { StepSchedule } from "./types";

/**
 * Deep-enough copy of the scheduling records for a second, independent pass:
 * `produced`/`consumed`/`passiveTasks` are copied (scheduleALAP pushes into
 * `produced`) and `ls`/`lf` reset. `stepObj` stays shared — the per-section
 * pass never writes to it (only `commitTimeline` does, and only for the
 * legacy pass).
 */
export function cloneSchedules(schedules: StepSchedule[]): StepSchedule[] {
	return schedules.map((s) => ({
		...s,
		produced: [...s.produced],
		consumed: [...s.consumed],
		passiveTasks: s.passiveTasks.map((t) => ({ ...t })),
		ls: 0,
		lf: 0,
	}));
}

/**
 * Planning where all the preparation happens first: the legacy timeline
 * (steps and passive tasks) pushed back by the total preparation time, with
 * one `prep` block per section laid end to end from T0.
 */
export function buildUpfrontSchedule(
	legacy: Timeline,
	mise: SectionMiseEnPlace[],
	preparationTime: number,
	activeTime: number,
): Schedule {
	const blocks: ScheduleBlock[] = [];
	let cursor = 0;
	for (const entry of mise) {
		blocks.push({
			kind: "prep",
			section: entry.section,
			start: cursor,
			end: cursor + entry.duration,
		});
		cursor += entry.duration;
	}
	for (const b of legacy.blocks) {
		blocks.push({
			...b,
			start: b.start + preparationTime,
			end: b.end + preparationTime,
		});
	}

	const totalTime = preparationTime + legacy.workflowDuration;
	return {
		totalTime,
		idleTime: totalTime - activeTime - preparationTime,
		blocks: sortBlocks(blocks),
	};
}

/**
 * Planning where each section's preparation is scheduled like a step of its
 * own, placed at the head of the section: the existing ALAP chaining then
 * makes it finish right when the section's first real step starts (and start
 * only once the previous section's work is done), so a preparation can
 * overlap the rest of an earlier section's resting time.
 *
 * Runs on a clone of the schedules and with its own warnings array — it must
 * never touch the compiled steps or the official warnings (see the caller).
 */
export function buildPerSectionSchedule(
	pristine: StepSchedule[],
	mise: SectionMiseEnPlace[],
	sections: ProcessedSection[],
	sectionASTs: SectionAST[],
	preparationTime: number,
	activeTime: number,
): { schedule: Schedule; warnings: Warning[] } {
	const schedules = cloneSchedules(pristine);

	for (const entry of mise) {
		const at = schedules.findIndex(
			(s) => s.sectionIndex === entry.section && !s.isComment,
		);
		if (at === -1) continue;
		schedules.splice(at, 0, {
			sectionIndex: entry.section,
			stepObj: null,
			isComment: false,
			isPrep: true,
			localActiveTime: entry.duration,
			productionTime: entry.duration,
			produced: [],
			consumed: [],
			passiveTasks: [],
			ls: 0,
			lf: 0,
		});
	}

	const warnings: Warning[] = [];
	scheduleALAP(schedules, sections, sectionASTs, warnings);
	const passiveTasks = serializeTracks(
		schedules,
		sections,
		sectionASTs,
		warnings,
	);
	const timeline = computeTimeline(schedules, passiveTasks, sections);

	const totalTime = timeline.blocks.reduce((max, b) => Math.max(max, b.end), 0);
	return {
		schedule: {
			totalTime,
			idleTime: totalTime - activeTime - preparationTime,
			blocks: timeline.blocks,
		},
		warnings,
	};
}

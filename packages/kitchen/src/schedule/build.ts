import type { SectionAST } from "@gram-lang/parser";
import { type MiseEnPlaceAnalysis, sumDuration } from "../mise-en-place";
import type { ScheduleMode } from "../schedule-mode";
import type {
	MiseEnPlaceItem,
	ProcessedSection,
	Schedule,
	SectionMiseEnPlace,
} from "../types";
import { type Warning, WarningCode } from "../warnings";
import { scheduleALAP } from "./alap";
import { computeTimeline, type Timeline } from "./rebase";
import {
	type SessionPlan,
	sessionPlan,
	sessionsOf,
	singleSessionPlan,
} from "./sessions";
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
 * What `scheduleWithGroups` needs to tell which intermediates a group makes
 * itself (see `analyzeMiseEnPlace`).
 */
type IntermediateInfo = Pick<MiseEnPlaceAnalysis, "producers" | "gathered">;

/** Without it every intermediate is of unknown origin, so it waits. */
const NO_INTERMEDIATES: IntermediateInfo = {
	producers: new Map(),
	gathered: new Map(),
};

/**
 * Splits a section's mise en place into what is gathered with its group and
 * what has to wait until right before the section: an intermediate made by a
 * section of the same group (or by none we can find, the safe choice) doesn't
 * exist yet when the group starts (a section without a step makes nothing).
 * With `defer` off nothing waits.
 */
function splitEntry(
	entry: SectionMiseEnPlace,
	group: Set<number>,
	withSteps: Set<number>,
	info: IntermediateInfo,
	defer: boolean,
): { head: MiseEnPlaceItem[]; later: MiseEnPlaceItem[] } {
	const head: MiseEnPlaceItem[] = [];
	const later: MiseEnPlaceItem[] = [];
	const waits = (id: string) => {
		const producer = info.producers.get(id);
		// A producer without a step makes nothing: as good as unknown.
		return (
			defer &&
			(producer === undefined ||
				group.has(producer) ||
				!withSteps.has(producer))
		);
	};
	for (const item of entry.items) {
		if (item.kind === "prepare") {
			(item.intermediate && waits(item.ref.id) ? later : head).push(item);
			continue;
		}
		const intermediates = item.intermediates ?? 0;
		if (intermediates === 0 || !defer) {
			head.push(item);
			continue;
		}
		const ids = info.gathered.get(entry.section) ?? [];
		// Without the ids to tell them apart, every intermediate waits.
		const waiting =
			ids.length === intermediates ? ids.filter(waits).length : intermediates;
		if (waiting === 0) {
			head.push(item);
			continue;
		}
		const share = item.duration / item.count;
		const left = item.count - waiting;
		if (left > 0) {
			const kept = intermediates - waiting;
			const { intermediates: _, ...rest } = item;
			head.push({
				...rest,
				count: left,
				duration: share * left,
				...(kept > 0 && { intermediates: kept }),
			});
		}
		later.push({
			...item,
			count: waiting,
			duration: share * waiting,
			intermediates: waiting,
		});
	}
	return { head, later };
}

/**
 * Runs the backward pass on a clone of the schedules, with the mise en place
 * of each group laid out as work of its own, so the existing ALAP chaining
 * makes it finish right when the work it precedes starts (and start only once
 * the previous work is done).
 *
 * Per group, in order, whatever the section's preparation can be gathered
 * before the group starts is inserted, one entry per section, at the head of
 * the group's first section; the preparation of an intermediate made within the
 * group is inserted at the head of its own section, so it is never planned
 * before it exists. One group per section gives `perSection`, one group for the
 * whole recipe gives `upfront`, one per working day gives `perSession`.
 *
 * With `defer` off nothing waits, whichever section makes it.
 */
function scheduleWithGroups(
	pristine: StepSchedule[],
	mise: SectionMiseEnPlace[],
	groups: number[][],
	sections: ProcessedSection[],
	sectionASTs: SectionAST[],
	info: IntermediateInfo,
	defer: boolean,
): { timeline: Timeline; warnings: Warning[] } {
	const schedules = cloneSchedules(pristine);
	const withSteps = new Set(
		pristine.filter((s) => !s.isComment).map((s) => s.sectionIndex),
	);
	const entryOf = new Map(mise.map((e) => [e.section, e]));

	const synthetic = (
		sectionIndex: number,
		prepFor: number,
		items: MiseEnPlaceItem[],
		whole: boolean,
		deferred: boolean,
	): StepSchedule => {
		const duration = sumDuration(items);
		return {
			sectionIndex,
			stepObj: null,
			isComment: false,
			isPrep: true,
			...(prepFor !== sectionIndex && { prepFor }),
			...(deferred && { deferred }),
			...(!whole && { items }),
			localActiveTime: duration,
			productionTime: duration,
			produced: [],
			consumed: [],
			passiveTasks: [],
			ls: 0,
			lf: 0,
		};
	};

	for (const sectionsOfGroup of groups) {
		const group = new Set(sectionsOfGroup);
		const heads: StepSchedule[] = [];
		const laters: { section: number; sched: StepSchedule }[] = [];
		const first = sectionsOfGroup.find((section) =>
			schedules.some((s) => s.sectionIndex === section && !s.isComment),
		);
		if (first === undefined) continue;

		for (const section of sectionsOfGroup) {
			const entry = entryOf.get(section);
			if (!entry) continue;
			const { head, later } = splitEntry(entry, group, withSteps, info, defer);
			const split = head.length > 0 && later.length > 0;
			if (head.length > 0) {
				heads.push(synthetic(first, section, head, !split, false));
			}
			if (later.length > 0) {
				laters.push({
					section,
					sched: synthetic(section, section, later, !split, true),
				});
			}
		}

		for (const { section, sched } of laters) {
			const at = schedules.findIndex(
				(s) => s.sectionIndex === section && !s.isComment,
			);
			if (at !== -1) schedules.splice(at, 0, sched);
		}
		// Gathered work comes first: before everything else in the group's first
		// section, deferred entries included.
		const headAt = schedules.findIndex(
			(s) => s.sectionIndex === first && !s.isComment,
		);
		schedules.splice(headAt, 0, ...heads);
	}

	const warnings: Warning[] = [];
	scheduleALAP(schedules, sections, sectionASTs, warnings);
	const passiveTasks = serializeTracks(
		schedules,
		sections,
		sectionASTs,
		warnings,
	);
	return {
		timeline: computeTimeline(schedules, passiveTasks, sections),
		warnings,
	};
}

/** Wraps a laid-out timeline into a `Schedule`, with its working-day sessions. */
function toSchedule(
	timeline: Timeline,
	{ groups, days }: SessionPlan,
	preparationTime: number,
	activeTime: number,
): Schedule {
	const totalTime = timeline.blocks.reduce((max, b) => Math.max(max, b.end), 0);
	return {
		totalTime,
		idleTime: totalTime - activeTime - preparationTime,
		blocks: timeline.blocks,
		sessions: sessionsOf(timeline.blocks, groups, days),
	};
}

/** How a mode groups the mise en place, and the days its sessions fall on. */
interface ModePlan {
	/** Sections whose mise en place is gathered together, in order. */
	groups: number[][];
	sessions: SessionPlan;
	/** Whether an intermediate made within its group waits until it exists. */
	defer: boolean;
}

const MODE_PLANS: Record<
	ScheduleMode,
	(sections: ProcessedSection[]) => ModePlan
> = {
	// Each section's preparation is scheduled like a step of its own, at the
	// head of the section: the ALAP chaining makes it finish right when the
	// section's first real step starts (and start only once the previous
	// section's work is done), so it can overlap an earlier section's resting
	// time. One section per group: nothing to defer.
	perSection: (sections) => ({
		groups: sections.map((_, i) => [i]),
		sessions: sessionPlan(sections),
		defer: false,
	}),
	// All the mise en place gathered first, in one session. An intermediate
	// can't be gathered before it exists, so its share is planned right before
	// the section that uses it instead.
	upfront: (sections) => {
		const sessions = singleSessionPlan(sections);
		return { groups: sessions.groups, sessions, defer: true };
	},
	// The mise en place of each working day (see `sessionDays`) gathered at the
	// start of that day: what a section needs from an earlier day is gathered at
	// the head of its own day, what is made the same day waits until right
	// before the section that uses it. Without an anchor of a day or more, the
	// recipe is a single session, like `upfront`.
	perSession: (sections) => {
		const sessions = sessionPlan(sections);
		return { groups: sessions.groups, sessions, defer: true };
	},
};

/**
 * The complete timeline of `mode`. Runs on a clone of the schedules and with
 * its own warnings array — it must never touch the compiled steps or the
 * official warnings (see the caller).
 */
export function buildSchedule(
	mode: ScheduleMode,
	pristine: StepSchedule[],
	mise: SectionMiseEnPlace[],
	sections: ProcessedSection[],
	sectionASTs: SectionAST[],
	preparationTime: number,
	activeTime: number,
	info: IntermediateInfo = NO_INTERMEDIATES,
): { schedule: Schedule; warnings: Warning[] } {
	const plan = MODE_PLANS[mode](sections);
	const { timeline, warnings } = scheduleWithGroups(
		pristine,
		mise,
		plan.groups,
		sections,
		sectionASTs,
		info,
		plan.defer,
	);
	return {
		schedule: toSchedule(timeline, plan.sessions, preparationTime, activeTime),
		warnings,
	};
}

/**
 * Whether two scheduling warnings report the same problem. A recipe is laid
 * out several times (the legacy pass, then one timeline per mise en place
 * mode), and a problem more than one layout runs into is reported once — but
 * the figures in its message depend on the layout: the instant a time paradox
 * is pulled to, the delay of a contention. A paradox is matched on where it
 * sits in the source, a contention on its message without the delay.
 */
export function isSameSchedulingProblem(a: Warning, b: Warning): boolean {
	if (a.code !== b.code) return false;
	if (a.code === WarningCode.TIME_PARADOX && a.loc) {
		return JSON.stringify(a.loc) === JSON.stringify(b.loc);
	}
	if (a.code === WarningCode.TRACK_CONTENTION) {
		const withoutDelay = (w: Warning) =>
			w.message.replace(/delayed by \S+ min/, "delayed");
		return withoutDelay(a) === withoutDelay(b);
	}
	return a.message === b.message;
}

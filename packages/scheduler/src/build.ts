import { sumDuration } from "./breakdown";
import { scheduleALAP } from "./alap";
import type { MiseEnPlaceMode } from "./mode";
import { computeTimeline, type Timeline } from "./rebase";
import {
	type SessionPlan,
	sessionPlan,
	sessionsOf,
	singleSessionPlan,
} from "./sessions";
import { serializeTracks } from "./tracks";
import type {
	MiseEnPlaceItem,
	ScheduleSession,
	SchedulingDiagnostic,
	SchedulingSection,
	StepSchedule,
} from "./types";

/**
 * Deep-enough copy of the scheduling records for a second, independent pass:
 * `produced`/`consumed`/`passiveTasks` are copied (scheduleALAP pushes into
 * `produced`) and `ls`/`lf` reset.
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

/** A `prep` task of the graph, as the layout passes read it. */
export interface PrepWork {
	id: string;
	section: number;
	/** Set for the preparation of an intermediate (`&dough`). */
	intermediate?: boolean;
	/**
	 * For an intermediate: the section whose step makes it. Absent when the graph
	 * can't tell, so it is planned right before the section that uses it.
	 */
	producer?: number;
	items: MiseEnPlaceItem[];
}

/**
 * The items of several preparations as one list, the way a section's mise en
 * place lists them: the ingredients gathered (`intermediates` counting how
 * many of them are made during the recipe), the cookware gathered, then every
 * preparation in order.
 */
export function mergeItems(parts: MiseEnPlaceItem[][]): MiseEnPlaceItem[] {
	const zero = () => ({ count: 0, duration: 0, intermediates: 0 });
	const gathered = { ingredient: zero(), cookware: zero() };
	const prepares: MiseEnPlaceItem[] = [];
	for (const items of parts) {
		for (const item of items) {
			if (item.kind === "prepare") {
				prepares.push(item);
				continue;
			}
			const total = gathered[item.target];
			total.count += item.count;
			total.duration += item.duration;
			total.intermediates += item.intermediates ?? 0;
		}
	}
	const merged: MiseEnPlaceItem[] = [];
	for (const target of ["ingredient", "cookware"] as const) {
		const { count, duration, intermediates } = gathered[target];
		if (count === 0) continue;
		merged.push({
			kind: "gather",
			target,
			count,
			duration,
			...(intermediates > 0 && { intermediates }),
		});
	}
	return [...merged, ...prepares];
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
	preps: PrepWork[],
	groups: number[][],
	sections: SchedulingSection[],
	defer: boolean,
): { timeline: Timeline; diagnostics: SchedulingDiagnostic[] } {
	const schedules = cloneSchedules(pristine);
	const withSteps = new Set(
		pristine.filter((s) => !s.isComment).map((s) => s.sectionIndex),
	);
	const prepsOf = new Map<number, PrepWork[]>();
	for (const prep of preps) {
		const list = prepsOf.get(prep.section);
		if (list) list.push(prep);
		else prepsOf.set(prep.section, [prep]);
	}

	const synthetic = (
		sectionIndex: number,
		prepFor: number,
		works: PrepWork[],
		whole: boolean,
		deferred: boolean,
	): StepSchedule => {
		const items = mergeItems(works.map((w) => w.items));
		const duration = sumDuration(items);
		return {
			taskId: works[0]!.id,
			sectionIndex,
			stepIndex: null,
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
		// An intermediate made by a section of the same group (or by none we can
		// find, the safe choice) doesn't exist yet when the group starts.
		const waits = (work: PrepWork) =>
			defer &&
			work.intermediate === true &&
			(work.producer === undefined ||
				group.has(work.producer) ||
				!withSteps.has(work.producer));
		const heads: StepSchedule[] = [];
		const laters: { section: number; sched: StepSchedule }[] = [];
		const first = sectionsOfGroup.find((section) =>
			schedules.some((s) => s.sectionIndex === section && !s.isComment),
		);
		if (first === undefined) continue;

		for (const section of sectionsOfGroup) {
			const works = prepsOf.get(section) ?? [];
			const head = works.filter((w) => !waits(w));
			const later = works.filter(waits);
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

	const diagnostics: SchedulingDiagnostic[] = [];
	scheduleALAP(schedules, sections, diagnostics);
	const passiveTasks = serializeTracks(schedules, diagnostics);
	return {
		timeline: computeTimeline(schedules, passiveTasks, sections),
		diagnostics,
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

const MODE_PLANS: Record<MiseEnPlaceMode, (days: number[]) => ModePlan> = {
	// Each section's preparation is scheduled like a step of its own, at the
	// head of the section: the ALAP chaining makes it finish right when the
	// section's first real step starts (and start only once the previous
	// section's work is done), so it can overlap an earlier section's resting
	// time. One section per group: nothing to defer.
	perSection: (days) => ({
		groups: days.map((_, i) => [i]),
		sessions: sessionPlan(days),
		defer: false,
	}),
	// All the mise en place gathered first, in one session. An intermediate
	// can't be gathered before it exists, so its share is planned right before
	// the section that uses it instead.
	upfront: (days) => {
		const sessions = singleSessionPlan(days);
		return { groups: sessions.groups, sessions, defer: true };
	},
	// The mise en place of each working day gathered at the start of that day:
	// what a section needs from an earlier day is gathered at the head of its
	// own day, what is made the same day waits until right before the section
	// that uses it. Without an anchor of a day or more, the recipe is a single
	// session, like `upfront`.
	perSession: (days) => {
		const sessions = sessionPlan(days);
		return { groups: sessions.groups, sessions, defer: true };
	},
};

/**
 * The blocks and sessions of `mode`. Runs on a clone of the schedules and with
 * its own diagnostics array — it must never touch the caller's records.
 */
export function buildSchedule(
	mode: MiseEnPlaceMode,
	pristine: StepSchedule[],
	preps: PrepWork[],
	sections: SchedulingSection[],
	days: number[],
): {
	blocks: Timeline["blocks"];
	sessions: ScheduleSession[];
	diagnostics: SchedulingDiagnostic[];
} {
	const plan = MODE_PLANS[mode](days);
	const { timeline, diagnostics } = scheduleWithGroups(
		pristine,
		preps,
		plan.groups,
		sections,
		plan.defer,
	);
	return {
		blocks: timeline.blocks,
		sessions: sessionsOf(
			timeline.blocks,
			plan.sessions.groups,
			plan.sessions.days,
		),
		diagnostics,
	};
}

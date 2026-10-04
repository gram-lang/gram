import { buildSchedule, type PrepWork } from "./build";
import type { TaskGraph, TaskDuration, TimerTask } from "./graph";
import {
	DEFAULT_MISE_EN_PLACE_MODE,
	DEFAULT_REST_CHOICE,
	type MiseEnPlaceMode,
	type RestChoice,
} from "./mode";
import { sessionOverflows } from "./sessions";
import type {
	PassiveTask,
	Schedule,
	SchedulingDiagnostic,
	SchedulingSection,
	StepSchedule,
} from "./types";

export interface LayoutOptions {
	/** Where the mise en place goes. Default `perSection`. */
	miseEnPlace?: MiseEnPlaceMode;
	/** How long a passive rest written as a range lasts. Default `shortest`. */
	rests?: RestChoice;
	/**
	 * Minutes to give particular rests, by the id of their task, instead of what
	 * `rests` picks: how the projection stretches a rest to dodge the night. A
	 * value outside the rest's range is ignored, so no rest is ever made longer
	 * or shorter than the recipe allows.
	 */
	restOverrides?: Record<string, number>;
}

export interface LayoutResult {
	schedule: Schedule;
	diagnostics: SchedulingDiagnostic[];
}

/**
 * How long a passive rest lasts under `rests`. Only a range has a choice to
 * make; `nominal` already is the shortest figure.
 */
function restDuration({ nominal, min, max }: TaskDuration, rests: RestChoice) {
	if (min === undefined || max === undefined) return nominal;
	if (rests === "longest") return max;
	if (rests === "balanced") return (min + max) / 2;
	return min;
}

/** The minutes asked for a timer, when they stay within its range. */
function overridden(
	timer: TimerTask,
	overrides: Record<string, number> | undefined,
): number | undefined {
	const minutes = overrides?.[timer.id];
	const { min, max } = timer.duration;
	if (minutes === undefined || min === undefined || max === undefined) {
		return undefined;
	}
	return minutes >= min && minutes <= max ? minutes : undefined;
}

/**
 * Lays the graph out on a timeline. Pure and deterministic: the same graph and
 * options always give the same schedule, and the graph is never modified.
 *
 * Active work is planned on its `nominal` duration whatever `rests` says, and
 * every passive rest on the figure `rests` picks in its range. The returned
 * diagnostics are the ones that don't depend on any reader's context: a time
 * paradox, a track contention, a session spilling out of its 24 h window.
 */
export function layout(
	graph: TaskGraph,
	options: LayoutOptions = {},
): LayoutResult {
	const miseEnPlace = options.miseEnPlace ?? DEFAULT_MISE_EN_PLACE_MODE;
	const rests = options.rests ?? DEFAULT_REST_CHOICE;

	const sections: SchedulingSection[] = graph.sections.map((s) => ({
		retro_planning: s.deadline === undefined ? null : { minutes: -s.deadline },
		...(s.intermediate !== undefined && {
			intermediate_preparation: s.intermediate,
		}),
	}));
	const days = graph.sections.map((s) => s.day);

	const timers = new Map<string, TimerTask[]>();
	const sectionOf = new Map<string, number>();
	for (const task of graph.tasks) {
		sectionOf.set(task.id, task.section);
		if (task.kind !== "passive") continue;
		const key = `${task.section}:${task.step}`;
		const list = timers.get(key);
		if (list) list.push(task);
		else timers.set(key, [task]);
	}

	const schedules: StepSchedule[] = [];
	const preps: PrepWork[] = [];
	let activeTime = 0;
	let preparationTime = 0;
	for (const task of graph.tasks) {
		if (task.kind === "prep") {
			preparationTime += task.duration.nominal;
			const producer = task.after[0];
			preps.push({
				id: task.id,
				section: task.section,
				...(task.intermediate !== undefined && { intermediate: true }),
				...(producer !== undefined &&
					sectionOf.has(producer) && { producer: sectionOf.get(producer) }),
				items: task.items,
			});
		} else if (task.kind === "step") {
			const localActiveTime = task.duration.nominal;
			const passiveTasks: PassiveTask[] = (
				timers.get(`${task.section}:${task.step}`) ?? []
			).map((t) => ({
				taskId: t.id,
				name: t.track ?? "Timer",
				duration:
					overridden(t, options.restOverrides) ??
					restDuration(t.duration, rests),
				localOffset: t.offset,
				isNamed: t.track !== undefined,
				...(t.track !== undefined && { sourceName: t.track }),
			}));
			let productionTime = localActiveTime;
			for (const p of passiveTasks) {
				productionTime = Math.max(productionTime, p.localOffset + p.duration);
			}
			schedules.push({
				taskId: task.id,
				sectionIndex: task.section,
				stepIndex: task.step,
				isComment: false,
				localActiveTime,
				productionTime,
				produced: [...(task.produces ?? [])],
				consumed: [...(task.consumes ?? [])],
				passiveTasks,
				ls: 0,
				lf: 0,
			});
			activeTime += localActiveTime;
		}
	}

	const built = buildSchedule(miseEnPlace, schedules, preps, sections, days);
	const totalTime = built.blocks.reduce((max, b) => Math.max(max, b.end), 0);
	const diagnostics = [
		...built.diagnostics,
		...sessionOverflows(built.sessions, built.blocks, totalTime),
	];
	return {
		schedule: {
			miseEnPlace,
			rests,
			totalTime,
			activeTime,
			preparationTime,
			idleTime: totalTime - activeTime - preparationTime,
			blocks: built.blocks,
			sessions: built.sessions,
		},
		diagnostics,
	};
}

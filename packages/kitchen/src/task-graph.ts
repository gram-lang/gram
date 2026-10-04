import type {
	MiseEnPlaceItem,
	PrepTask,
	StepTask,
	Task,
	TaskDuration,
	TaskGraph,
	TimerTask,
} from "@gram-lang/scheduler";
import { MINUTES_PER_DAY } from "@gram-lang/scheduler";
import type { MiseEnPlaceAnalysis } from "./mise-en-place";
import type { ProcessedSection } from "./types";
import { slugify } from "./utils";

/** A timer of a step, as the forward pass found it. */
export interface TimerFact {
	/** The track's name, for a named passive timer. */
	track?: string;
	/** Minutes of the step's own active work that come before it. */
	offset: number;
	duration: TaskDuration;
}

/** What the forward pass learns about one step, for the graph. */
export interface StepFact {
	section: number;
	/** Index in the section's steps, comments included. */
	step: number;
	/** The hands-on time, on its longest figure when written as a range. */
	active: number;
	timers: TimerFact[];
	produced: string[];
	consumed: string[];
}

/** The task ids, stable and readable: `s0.prep`, `s1.prep.dough`, `s0.3`, `s0.3.t0`. */
export const taskIds = {
	prep: (section: number) => `s${section}.prep`,
	intermediatePrep: (section: number, id: string) => `s${section}.prep.${id}`,
	step: (section: number, step: number) => `s${section}.${step}`,
	timer: (section: number, step: number, index: number) =>
		`s${section}.${step}.t${index}`,
};

/**
 * The working day of every section: 0 is the day itself, 1 the day before
 * (`~{-1d}`), and so on. Only an anchor in days opens a day; one in hours or
 * minutes is a deadline inside the day the section falls on. A section without
 * an anchor of its own sits on the day of the furthest anchor in days among the
 * sections after it (like ALAP, which places it as late as it can), and on day
 * 0 when there is none.
 */
export function sectionDays(sections: ProcessedSection[]): number[] {
	const days: number[] = new Array(sections.length).fill(0);
	let running = 0;
	for (let i = sections.length - 1; i >= 0; i--) {
		const rp = sections[i]!.retro_planning;
		if (rp?.unit === "d" && rp.minutes !== undefined) {
			running = Math.max(
				running,
				Math.floor(Math.abs(rp.minutes) / MINUTES_PER_DAY),
			);
		}
		days[i] = running;
	}
	return days;
}

/** A passive rest is the shortest it can be by default, so that is its `nominal`. */
function timerDuration({ nominal, min, max }: TaskDuration): TaskDuration {
	return min === undefined || max === undefined
		? { nominal }
		: { nominal, min, max };
}

/**
 * Splits a section's mise en place into the raw part (what is gathered or
 * prepared from ingredients that exist from the start) and one task per
 * intermediate it consumes, so each can be planned once its own intermediate
 * exists. Together they carry exactly the section's items.
 */
function prepTasksOf(
	entry: MiseEnPlaceAnalysis["entries"][number],
	analysis: MiseEnPlaceAnalysis,
	producerTask: (intermediate: string) => string | undefined,
): PrepTask[] {
	const section = entry.section;
	const raw: MiseEnPlaceItem[] = [];
	const intermediates: PrepTask[] = [];
	const gatheredIds = analysis.gathered.get(section) ?? [];

	const intermediatePrep = (id: string, items: MiseEnPlaceItem[]): PrepTask => {
		const after = producerTask(id);
		return {
			id: taskIds.intermediatePrep(section, id),
			kind: "prep",
			section,
			intermediate: id,
			duration: {
				nominal: items.reduce((total, item) => total + item.duration, 0),
			},
			items,
			after: after === undefined ? [] : [after],
		};
	};

	for (const item of entry.items) {
		if (item.kind === "prepare") {
			if (item.intermediate) {
				intermediates.push(intermediatePrep(item.ref.id, [item]));
			} else raw.push(item);
			continue;
		}
		const count = item.intermediates ?? 0;
		if (count === 0) {
			raw.push(item);
			continue;
		}
		// One gather per intermediate: `gathered` lists exactly the ids the item counts.
		const share = item.duration / item.count;
		const rest = item.count - count;
		if (rest > 0) {
			const { intermediates: _, ...plain } = item;
			raw.push({ ...plain, count: rest, duration: share * rest });
		}
		for (const id of gatheredIds) {
			intermediates.push(
				intermediatePrep(id, [
					{ ...item, count: 1, duration: share, intermediates: 1 },
				]),
			);
		}
	}

	const tasks: PrepTask[] = [];
	if (raw.length > 0) {
		tasks.push({
			id: taskIds.prep(section),
			kind: "prep",
			section,
			duration: {
				nominal: raw.reduce((total, item) => total + item.duration, 0),
			},
			items: raw,
			after: [],
		});
	}
	return [...tasks, ...intermediates];
}

/**
 * The task graph of a compiled recipe: what the scheduler needs to lay it out,
 * independent of any option. Tasks come section by section, the mise en place
 * first, then each step followed by its timers.
 */
export function buildTaskGraph(
	sections: ProcessedSection[],
	facts: StepFact[],
	analysis: MiseEnPlaceAnalysis,
): TaskGraph {
	const days = sectionDays(sections);
	const factsOf = new Map<number, StepFact[]>();
	for (const fact of facts) {
		const list = factsOf.get(fact.section);
		if (list) list.push(fact);
		else factsOf.set(fact.section, [fact]);
	}
	const idOf = (fact: StepFact) => taskIds.step(fact.section, fact.step);

	// Who makes each intermediate: the section that declares it as a whole (its
	// last step finishes it), else the step that declares it.
	const makerOf = new Map<string, string>();
	for (const fact of facts) {
		for (const name of fact.produced) makerOf.set(name, idOf(fact));
	}
	sections.forEach((sec, index) => {
		const last = factsOf.get(index)?.at(-1);
		if (sec.intermediate_preparation && last) {
			makerOf.set(sec.intermediate_preparation, idOf(last));
		}
	});
	// The same, by the slug the mise en place knows an intermediate by.
	const makerOfSlug = new Map<string, string>();
	for (const [name, id] of makerOf) makerOfSlug.set(slugify(name), id);
	const producerTask = (intermediate: string): string | undefined => {
		const section = analysis.producers.get(intermediate);
		if (section === undefined) return undefined;
		const maker = makerOfSlug.get(intermediate);
		if (maker !== undefined && maker.startsWith(`s${section}.`)) return maker;
		const last = factsOf.get(section)?.at(-1);
		return last === undefined ? undefined : idOf(last);
	};

	const prepsOf = new Map(
		analysis.entries.map((entry) => [
			entry.section,
			prepTasksOf(entry, analysis, producerTask),
		]),
	);

	const tasks: Task[] = [];
	sections.forEach((_, index) => {
		tasks.push(...(prepsOf.get(index) ?? []));
		let previous: string | undefined;
		for (const fact of factsOf.get(index) ?? []) {
			const id = idOf(fact);
			const after = new Set<string>();
			if (previous !== undefined) after.add(previous);
			for (const name of fact.consumed) {
				const maker = makerOf.get(name);
				if (maker !== undefined && maker !== id) after.add(maker);
			}
			const step: StepTask = {
				id,
				kind: "step",
				section: fact.section,
				step: fact.step,
				duration: { nominal: fact.active },
				...(fact.produced.length > 0 && { produces: [...fact.produced] }),
				...(fact.consumed.length > 0 && { consumes: [...fact.consumed] }),
				after: [...after],
			};
			tasks.push(step);
			fact.timers.forEach((timer, k) => {
				const task: TimerTask = {
					id: taskIds.timer(fact.section, fact.step, k),
					kind: "passive",
					section: fact.section,
					step: fact.step,
					...(timer.track !== undefined && { track: timer.track }),
					offset: timer.offset,
					duration: timerDuration(timer.duration),
					after: [id],
				};
				tasks.push(task);
			});
			previous = id;
		}
	});

	return {
		tasks,
		sections: sections.map((sec, index) => {
			const minutes = sec.retro_planning?.minutes;
			return {
				day: days[index]!,
				...(minutes !== undefined && { deadline: Math.abs(minutes) }),
				...(sec.intermediate_preparation !== undefined && {
					intermediate: sec.intermediate_preparation,
				}),
			};
		}),
	};
}

import type { TaskGraph } from "./graph";
import type { MiseEnPlaceMode } from "./mode";
import type {
	ProjectedBlock,
	ProjectedPlan,
	ProjectionContext,
	ProjectionDiagnostic,
	RestAdjustment,
} from "./projection";
import { visitWindows } from "./windows";
import type { Schedule, ScheduleBlock } from "./types";
import { MINUTES_PER_DAY } from "./days";
import { daysBetween, parseInstant, parseLocalIso, toLocalIso } from "./time";

const EPS = 1e-6;

/**
 * A wait of at least this many minutes between two stretches of the cook's
 * own work ends a visit: the cook leaves the kitchen, or at least is free
 * to. A shorter wait is part of the visit and is not told.
 */
export const VISIT_GAP_MINUTES = 60;

/**
 * One line of the production sheet: a task, when it starts and ends, for how
 * long. `from` and `to` are minutes from the service, so negative before it,
 * in a plan with a serving time or without one; the ISO and local fields come
 * with the calendar only.
 */
export interface RunSheetEntry {
	task: string;
	kind: ProjectedBlock["kind"];
	/** True when the cook's hands are busy. */
	active: boolean;
	section: number;
	/** Index in the section's steps, for a step or a timer. */
	step?: number;
	/** The named track of a timer. */
	track?: string;
	/** Minutes from the service (<= 0). */
	from: number;
	to: number;
	minutes: number;
	/** ISO instants, UTC. Calendar plans only. */
	start?: string;
	end?: string;
	/** The wall clock of the plan's time zone, exact to the minute: rounding is for display. */
	startLocal?: string;
	endLocal?: string;
	/** Set when the plan made this rest longer or shorter, and why. */
	adjustment?: RestAdjustment;
}

/**
 * A moment in the kitchen: stretches of the cook's own work that follow each
 * other, with no wait of `VISIT_GAP_MINUTES` or more between them.
 */
export interface RunSheetVisit {
	/** Minutes from the service (<= 0), exact: rounding is for display. */
	start: number;
	end: number;
	startLocal?: string;
	endLocal?: string;
	/**
	 * The sections with work in the visit, in recipe order: a step, or the mise
	 * en place gathered there for a section that is cooked later.
	 */
	sections: number[];
	/**
	 * The sections with a step in the visit, in recipe order: where the cook
	 * actually works. Empty for a visit of mise en place only; see
	 * `visitSections`.
	 */
	worked: number[];
	/** The tasks of the visit: preparations and steps, in the order they start. */
	tasks: string[];
	/**
	 * How early the visit could happen with every other one where it is
	 * planned, when that is at least `WINDOW_MIN_MINUTES`. Needs `graph` and
	 * `context` in the options.
	 */
	window?: {
		/** Minutes the visit could move earlier. */
		advance: number;
		/** Minutes from the service. */
		earliest: number;
		earliestLocal: string;
	};
	/** The wait that holds the visit in place, when there is no margin. */
	fixedBy?: RunSheetFixedBy;
}

/** A wait that cannot give: the visit can't move without stretching or shrinking it. */
export interface RunSheetFixedBy {
	task: string;
	section: number;
	step?: number;
	track?: string;
	/** The planned minutes of the wait. */
	planned: number;
	/** What the wait leads to: the service or the next visit of `sections`. */
	before: "service" | "visit";
	sections?: number[];
}

/** What goes on without the cook after a visit: a timer that outlasts it. */
export interface RunSheetThread {
	/** Index in the day's `visits`. */
	visit: number;
	task: string;
	section: number;
	step?: number;
	track?: string;
	from: number;
	to: number;
	/** The planned minutes, adjustments included. */
	planned: number;
	fromLocal?: string;
	toLocal?: string;
	/** The range the recipe allows, when it writes one and the graph is given. */
	range?: { min: number; max: number };
}

/** What happens on one working day, in order. */
export interface RunSheetDay {
	/** "2026-10-10": the date the work starts, in a plan with a serving time. */
	date?: string;
	/** The working day of the recipe: 0 for the day itself, 1 for the day before, and so on. */
	daysBefore: number;
	/** Every task of the day, active or not, in the order they start. */
	entries: RunSheetEntry[];
	visits: RunSheetVisit[];
	threads: RunSheetThread[];
}

/** A rest the plan made longer or shorter, and where it belongs. */
export interface RunSheetAdjustment extends RestAdjustment {
	section: number;
	step?: number;
	track?: string;
	/** `daysBefore` of the day it falls on. */
	day: number;
}

export interface RunSheet {
	/** `calendar` when a serving time places the plan on dates, `relative` otherwise. */
	mode: "calendar" | "relative";
	serveAt?: string;
	timeZone?: string;
	recipes: {
		title?: string;
		/** Where the mise en place goes in this plan. */
		miseEnPlace: MiseEnPlaceMode;
		days: RunSheetDay[];
		/** Minutes of the cook's own work, mise en place included. Waiting is not counted. */
		totalWork: number;
	}[];
	adjustments: RunSheetAdjustment[];
	/** Everything the plan could not make right. */
	diagnostics: ProjectionDiagnostic[];
}

export interface RunSheetOptions {
	/** The graph the plan was made from: gives each timer its written range. */
	graph?: TaskGraph;
	/** The title of a recipe laid out without a serving time. */
	title?: string;
	/**
	 * With `graph`, a plan with a serving time gets the margin of each visit
	 * (`window`, `fixedBy`): the availability and the present bound it.
	 */
	context?: ProjectionContext;
}

interface SourceBlock {
	task: string;
	kind: ScheduleBlock["kind"];
	section: number;
	step?: number;
	track?: string;
	from: number;
	to: number;
	start?: string;
	end?: string;
	startLocal?: string;
	endLocal?: string;
}

interface Source {
	title?: string;
	miseEnPlace: MiseEnPlaceMode;
	blocks: SourceBlock[];
	days: { day: number; sections: number[] }[];
}

const meta = (b: {
	step?: number;
	track?: string;
}): { step?: number; track?: string } => ({
	...(b.step !== undefined && { step: b.step }),
	...(b.track !== undefined && { track: b.track }),
});

function fromSchedule(schedule: Schedule, title?: string): Source {
	return {
		...(title !== undefined && { title }),
		miseEnPlace: schedule.miseEnPlace,
		blocks: schedule.blocks.map((b) => ({
			task: b.task,
			kind: b.kind,
			section: b.section,
			...meta(b as { step?: number; track?: string }),
			from: b.start - schedule.totalTime,
			to: b.end - schedule.totalTime,
		})),
		days: schedule.days.map((s) => ({
			day: s.day,
			sections: s.sections,
		})),
	};
}

function fromPlan(
	recipe: ProjectedPlan["recipes"][number],
	serve: number,
	timeZone: string,
): Source {
	const rel = (iso: string) => parseInstant(iso, timeZone) - serve;
	return {
		...(recipe.title !== undefined && { title: recipe.title }),
		miseEnPlace: recipe.miseEnPlace,
		blocks: recipe.blocks.map((b) => ({
			task: b.task,
			kind: b.kind,
			section: b.section,
			...meta(b as { step?: number; track?: string }),
			from: rel(b.start),
			to: rel(b.end),
			start: b.start,
			end: b.end,
			startLocal: b.startLocal,
			endLocal: b.endLocal,
		})),
		days: recipe.days.map((s) => ({
			day: s.day,
			sections: s.sections,
		})),
	};
}

function ranges(graph?: TaskGraph) {
	const out = new Map<string, { min: number; max: number }>();
	for (const task of graph?.tasks ?? []) {
		if (task.kind !== "passive") continue;
		const { min, max } = task.duration;
		if (min !== undefined && max !== undefined && min < max) {
			out.set(task.id, { min, max });
		}
	}
	return out;
}

/**
 * The structure of a production sheet: for each recipe, its working days; for
 * each day, the visits in the kitchen and what goes on between them. Words
 * and layout belong to the renderer; nothing here is rounded or translated.
 *
 * A recipe with a serving time is read from the projected plan (`calendar`);
 * a bare `Schedule` gives the same structure without dates (`relative`).
 */
export function runSheet(
	source: ProjectedPlan | Schedule,
	options: RunSheetOptions = {},
): RunSheet {
	const ranged = ranges(options.graph);
	if (!("recipes" in source)) {
		const recipe = buildRecipe(
			fromSchedule(source, options.title),
			undefined,
			ranged,
			new Map(),
		);
		return {
			mode: "relative",
			recipes: [recipe.recipe],
			adjustments: [],
			diagnostics: [],
		};
	}

	const plan = source;
	const { timeZone } = plan;
	const serve = parseLocalIso(plan.serveAt, timeZone);
	const adjustments = new Map(plan.adjustments.map((a) => [a.task, a]));
	const built = plan.recipes.map((recipe) =>
		buildRecipe(
			fromPlan(recipe, serve, timeZone),
			{ serve, timeZone, serveDate: plan.serveAt.slice(0, 10) },
			ranged,
			adjustments,
		),
	);
	const sheet: RunSheet = {
		mode: "calendar",
		serveAt: plan.serveAt,
		timeZone,
		recipes: built.map((b) => b.recipe),
		adjustments: built.flatMap((b) => b.adjustments),
		diagnostics: plan.diagnostics,
	};
	return options.graph && options.context
		? visitWindows(sheet, options.graph, options.context)
		: sheet;
}

interface Calendar {
	serve: number;
	timeZone: string;
	/** The local date of the service, "2026-10-11". */
	serveDate: string;
}

function buildRecipe(
	source: Source,
	calendar: Calendar | undefined,
	ranged: Map<string, { min: number; max: number }>,
	adjusted: Map<string, RestAdjustment>,
) {
	const local = (minutes: number) =>
		calendar && toLocalIso(calendar.serve + minutes, calendar.timeZone);

	const dayOf = new Map<number, number>();
	source.days.forEach((s, i) => {
		for (const section of s.sections) dayOf.set(section, i);
	});
	const perDay: SourceBlock[][] = source.days.map(() => []);
	for (const block of source.blocks) {
		let index = dayOf.get(block.section);
		if (index === undefined) {
			// A section with no work of its own has no working day of its own: its
			// waits follow the day that starts last before them.
			index = 0;
			for (let i = 0; i < perDay.length; i++) {
				const first = perDay[i]![0];
				if (first && first.from <= block.from + EPS) index = i;
			}
		}
		perDay[index]?.push(block);
	}

	const adjustments: RunSheetAdjustment[] = [];
	const days: RunSheetDay[] = [];
	source.days.forEach((workingDay, i) => {
		const blocks = perDay[i]!.sort((a, b) => a.from - b.from || a.to - b.to);
		if (blocks.length === 0) return;

		const entries: RunSheetEntry[] = blocks.map((b) => ({
			task: b.task,
			kind: b.kind,
			active: b.kind !== "passive",
			section: b.section,
			...meta(b),
			from: b.from,
			to: b.to,
			minutes: b.to - b.from,
			...(b.start !== undefined && { start: b.start }),
			...(b.end !== undefined && { end: b.end }),
			...(b.startLocal !== undefined && { startLocal: b.startLocal }),
			...(b.endLocal !== undefined && { endLocal: b.endLocal }),
			...(adjusted.has(b.task) && { adjustment: adjusted.get(b.task)! }),
		}));

		const visits: RunSheetVisit[] = [];
		let reach = -Infinity;
		for (const b of blocks.filter((x) => x.kind !== "passive")) {
			const last = visits.at(-1);
			if (last && b.from - reach < VISIT_GAP_MINUTES - EPS) {
				last.end = Math.max(last.end, b.to);
				last.tasks.push(b.task);
				if (!last.sections.includes(b.section)) last.sections.push(b.section);
				if (b.kind === "step" && !last.worked.includes(b.section)) {
					last.worked.push(b.section);
				}
			} else {
				visits.push({
					start: b.from,
					end: b.to,
					sections: [b.section],
					worked: b.kind === "step" ? [b.section] : [],
					tasks: [b.task],
				});
			}
			reach = Math.max(reach, b.to);
		}
		for (const p of visits) {
			p.sections.sort((a, b) => a - b);
			p.worked.sort((a, b) => a - b);
			const startLocal = local(p.start);
			const endLocal = local(p.end);
			if (startLocal !== undefined) p.startLocal = startLocal;
			if (endLocal !== undefined) p.endLocal = endLocal;
		}

		const threads: RunSheetThread[] = [];
		for (const b of blocks.filter((x) => x.kind === "passive")) {
			let visit = 0;
			visits.forEach((p, k) => {
				if (p.start <= b.from + EPS) visit = k;
			});
			const home = visits[visit];
			if (!home || b.to <= home.end + EPS) continue;
			const range = ranged.get(b.task);
			const fromLocal = local(b.from);
			const toLocal = local(b.to);
			threads.push({
				visit,
				task: b.task,
				section: b.section,
				...meta(b),
				from: b.from,
				to: b.to,
				planned: b.to - b.from,
				...(fromLocal !== undefined && { fromLocal }),
				...(toLocal !== undefined && { toLocal }),
				...(range && { range }),
			});
		}

		// A working day is a day of the recipe; on the calendar, a day is a date.
		// One that runs on past midnight (everything in one go) is told per date,
		// and a visit that crosses midnight stays whole on the date it starts.
		// With no clock, the service is the only landmark: a visit is on the day
		// as many whole days before it as it is far from it, never further than
		// the working day itself. That only tells a day that spans a full day or
		// more (`upfront`, rests included); a shorter one is a single day.
		const spansDays =
			visits.length > 0 &&
			visits.at(-1)!.start - visits[0]!.start >= MINUTES_PER_DAY - EPS;
		const dayOfVisit = (p: RunSheetVisit) =>
			calendar
				? p.startLocal?.slice(0, 10)
				: spansDays
					? Math.min(
							workingDay.day,
							Math.max(0, Math.floor((-p.start + EPS) / MINUTES_PER_DAY)),
						)
					: workingDay.day;
		const groups: number[][] = [];
		visits.forEach((p, k) => {
			const last = groups.at(-1);
			if (last && dayOfVisit(visits[last[0]!]!) === dayOfVisit(p)) last.push(k);
			else groups.push([k]);
		});

		groups.forEach((group, g) => {
			const first = visits[group[0]!]!;
			const next = groups[g + 1];
			const until = next ? visits[next[0]!]!.start : Infinity;
			const lower = g === 0 ? -Infinity : first.start;
			const date = first.startLocal?.slice(0, 10);
			const day = dayOfVisit(first);
			const daysBefore =
				calendar && date !== undefined
					? daysBetween(date, calendar.serveDate)
					: (day as number);
			const own = entries.filter(
				(e) => e.from >= lower - EPS && e.from < until - EPS,
			);
			for (const entry of own) {
				if (!entry.adjustment) continue;
				adjustments.push({
					...entry.adjustment,
					section: entry.section,
					...meta(entry),
					day: daysBefore,
				});
			}
			days.push({
				...(date !== undefined && { date }),
				daysBefore,
				entries: own,
				visits: group.map((k) => visits[k]!),
				threads: threads
					.filter((t) => group.includes(t.visit))
					.map((t) => ({ ...t, visit: group.indexOf(t.visit) })),
			});
		});
	});

	const totalWork = source.blocks
		.filter((b) => b.kind !== "passive")
		.reduce((sum, b) => sum + (b.to - b.from), 0);
	return {
		recipe: {
			...(source.title !== undefined && { title: source.title }),
			miseEnPlace: source.miseEnPlace,
			days,
			totalWork,
		},
		adjustments,
	};
}

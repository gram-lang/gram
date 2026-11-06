import { scheduleFor } from "@gram-lang/kitchen";
import {
	type Availability,
	type EarliestServe,
	type FindServeOptions,
	type ProjectedPlan,
	type ProjectionContext,
	type ProjectionInput,
	type RunSheet,
	type ServeSearch,
	earliestServe,
	findServeTimes,
	project,
	runSheet,
} from "@gram-lang/scheduler";
import { DEFAULT_VIEW_SETTINGS, type ViewSettings } from "./settings";
import type { RenderableCompilationResult } from "./types";

/** The cook's kitchen: where the clock is, when they are there, and the present. */
export interface KitchenContext {
	/** An IANA zone, "Europe/Paris". */
	timeZone: string;
	availability: Availability;
	/** The present: an ISO instant, or a local time in `timeZone`. */
	now?: string;
}

export interface PrepareViewsOptions {
	/** The language of the words, for the surfaces that pass it on. */
	lang?: string;
	/** Needed for a plan on the calendar and for the serving time search. */
	kitchen?: KitchenContext;
	/**
	 * When it is served: a local date-time, "2026-10-11T13:00", in the
	 * kitchen's time zone. With it the plan is on the calendar; without, it is
	 * laid out in days before the service.
	 */
	serveAt?: string;
}

/** The schedule laid out for the chosen settings, as `scheduleFor` gives it. */
export type ViewSchedule = NonNullable<ReturnType<typeof scheduleFor>>;

/**
 * Everything a view is built from, computed once for every view that reads it.
 * The parts that cost something (the schedule, the plan, the run sheet, the
 * serving time search) are only worked out the first time they are read.
 */
export interface ViewInput {
	/** The compiled, or already analyzed, recipe. */
	readonly recipe: RenderableCompilationResult;
	readonly settings: ViewSettings;
	readonly lang: string | undefined;
	readonly kitchen: KitchenContext | undefined;
	readonly serveAt: string | undefined;
	/**
	 * The timeline of the recipe for these settings, in minutes from its start:
	 * the same at any serving time. `null` when there is nothing to schedule.
	 */
	readonly schedule: ViewSchedule | null;
	/** The total and idle time of `schedule`, or of the recipe's metrics without it. */
	readonly times: { totalTime: number; idleTime: number };
	/** The plan on the calendar, ending at `serveAt`. `null` without a serving time. */
	readonly plan: ProjectedPlan | null;
	/**
	 * The run sheet: on the calendar with a serving time, in days before the
	 * service without. `null` when there is nothing to schedule.
	 */
	readonly runSheet: RunSheet | null;
	/** What the serving time search starts from. `null` without a kitchen or tasks. */
	readonly projection: {
		input: ProjectionInput;
		context: ProjectionContext;
	} | null;
	/**
	 * The first serving time that works if the cook starts at `from` (default:
	 * the kitchen's present, or the real time). `null` without a kitchen.
	 */
	earliestServe(options?: { from?: string }): EarliestServe | null;
	/** The serving times worth proposing in a range. `null` without a kitchen. */
	findServeTimes(options: FindServeOptions): ServeSearch | null;
}

// A projection needs a serving time; the search replaces it with every time it
// tries, so this one is never read.
const ANY_SERVING_TIME = "1970-01-01T00:00";

/**
 * The one entry point of the views: the recipe, the settings, and what is
 * worked out from them (the schedule, the plan, the run sheet, the serving time
 * search), computed once and only when a view asks for it.
 *
 * Analysis needs an ingredient database that each surface loads its own way,
 * so this never analyzes: give it the analyzed recipe when there is one.
 */
export function prepareViews(
	recipe: RenderableCompilationResult,
	settings: Partial<ViewSettings> = {},
	options: PrepareViewsOptions = {},
): ViewInput {
	// A setting given as `undefined` (an option left unset) keeps its default.
	const given = Object.fromEntries(
		Object.entries(settings).filter(([, value]) => value !== undefined),
	);
	const full: ViewSettings = { ...DEFAULT_VIEW_SETTINGS, ...given };
	const { kitchen, serveAt, lang } = options;
	if (serveAt !== undefined && !kitchen) {
		throw new RangeError(
			"prepareViews: a serving time needs a kitchen (time zone, availability)",
		);
	}
	const title = recipe.title || undefined;
	const layout = { miseEnPlace: full.miseEnPlace, rests: full.rests };

	const memo = new Map<string, unknown>();
	function once<T>(key: string, make: () => T): T {
		if (!memo.has(key)) memo.set(key, make());
		return memo.get(key) as T;
	}

	const input: ViewInput = {
		recipe,
		settings: full,
		lang,
		kitchen,
		serveAt,
		get schedule() {
			return once(
				"schedule",
				() => scheduleFor(recipe, full.miseEnPlace, full.rests) ?? null,
			);
		},
		get times() {
			return once("times", () => {
				const schedule = input.schedule;
				return {
					totalTime: schedule?.totalTime ?? recipe.metrics?.totalTime ?? 0,
					idleTime: schedule?.idleTime ?? recipe.metrics?.idleTime ?? 0,
				};
			});
		},
		get projection() {
			return once("projection", () => {
				if (!kitchen || !recipe.tasks) return null;
				return {
					input: { graph: recipe.tasks, title, options: layout },
					context: {
						serveAt: serveAt ?? ANY_SERVING_TIME,
						timeZone: kitchen.timeZone,
						availability: kitchen.availability,
						...(kitchen.now !== undefined && { now: kitchen.now }),
					},
				};
			});
		},
		get plan() {
			return once("plan", () => {
				const projection = input.projection;
				if (serveAt === undefined || !projection) return null;
				return project([projection.input], projection.context);
			});
		},
		get runSheet() {
			return once("runSheet", () => {
				const graph = recipe.tasks;
				if (serveAt !== undefined) {
					const plan = input.plan;
					const context = input.projection?.context;
					return plan ? runSheet(plan, { graph, context }) : null;
				}
				const schedule = input.schedule;
				return schedule
					? runSheet(schedule, { graph, ...(title && { title }) })
					: null;
			});
		},
		earliestServe(opts = {}) {
			const projection = input.projection;
			if (!projection) return null;
			return earliestServe(
				projection.input,
				{
					...projection.context,
					now: projection.context.now ?? new Date().toISOString(),
				},
				opts,
			);
		},
		findServeTimes(opts) {
			const projection = input.projection;
			if (!projection) return null;
			return findServeTimes(projection.input, projection.context, opts);
		},
	};
	return input;
}

import { layout } from "./layout";
import type {
	ProjectedPlan,
	ProjectionContext,
	ProjectionDiagnostic,
	ProjectionInput,
} from "./projection";
import { project } from "./project";
import { runSheet } from "./runsheet";
import { addDays, parseClock, parseInstant, toLocalIso } from "./time";

/** The meals a service time is looked for at, when none is given. */
export const DEFAULT_MEAL_TIMES = ["12:30", "20:00"];

/** How far `earliestServe` looks before giving up, in days. */
export const EARLIEST_SERVE_HORIZON_DAYS = 14;

const SEARCH_STEP_MINUTES = 5;
const MAX_DAYS = 366;

/** One serving time tried: what it takes, and what is wrong with it if anything. */
export interface ServeCandidate {
	/** Local, in the context's time zone: "2026-10-17T20:00". */
	serveAt: string;
	/** True when nothing is left unresolved: the plan can be followed. */
	ok: boolean;
	/** Why it can't be followed (`MULTI_RECIPE_UNSUPPORTED` is about the input, not the time). */
	reasons: ProjectionDiagnostic[];
	/** Rests the plan had to make longer or shorter. */
	adjustments: number;
	/** Moments in the kitchen, all days together. */
	passages: number;
	/** Local date-time of the first task, when there is one: "you would have to start Thursday". */
	startsAt?: string;
	plan: ProjectedPlan;
}

/**
 * Plans a recipe for one serving time and says whether it can be followed.
 * The core of every search below: no algorithm of its own, just `project()`.
 */
export function tryServeAt(
	input: ProjectionInput,
	context: ProjectionContext,
	serveAt: string,
): ServeCandidate {
	const plan = project([input], { ...context, serveAt });
	const reasons = plan.diagnostics.filter(
		(d) => d.code !== "MULTI_RECIPE_UNSUPPORTED",
	);
	const sheet = runSheet(plan);
	const blocks = plan.recipes[0]?.blocks ?? [];
	const startsAt = blocks.map((b) => b.startLocal).sort()[0];
	return {
		serveAt,
		ok: reasons.length === 0,
		reasons,
		adjustments: plan.adjustments.length,
		passages:
			sheet.recipes[0]?.days.reduce((n, d) => n + d.passages.length, 0) ?? 0,
		...(startsAt !== undefined && { startsAt }),
		plan,
	};
}

export interface FindServeOptions {
	/** First moment to consider, local: "2026-10-12" or "2026-10-12T08:00". */
	from: string;
	/** Last moment to consider, local, same forms; a bare date means its whole day. */
	to: string;
	/** Times of day to try on each date. Default `DEFAULT_MEAL_TIMES`. */
	mealTimes?: string[];
	/** How many feasible times to return. Default 5. */
	limit?: number;
}

export interface ServeSearch {
	/** Feasible times, best first: fewer adjustments, then fewer passages, then the earliest. */
	candidates: ServeCandidate[];
	/** Every time that was tried and failed, each with its reasons, in time order. */
	rejected: ServeCandidate[];
}

const lower = (v: string) => (v.length === 10 ? `${v}T00:00` : v);
const upper = (v: string) => (v.length === 10 ? `${v}T23:59` : v);

/**
 * The serving times worth proposing between two moments: each date at each
 * meal time is planned with `project()`, those that can't be followed are
 * rejected with their reasons, the others are ranked.
 */
export function findServeTimes(
	input: ProjectionInput,
	context: ProjectionContext,
	options: FindServeOptions,
): ServeSearch {
	const meals = [...(options.mealTimes ?? DEFAULT_MEAL_TIMES)].sort(
		(a, b) => parseClock(a) - parseClock(b),
	);
	const from = lower(options.from);
	const to = upper(options.to);
	const found: ServeCandidate[] = [];
	const rejected: ServeCandidate[] = [];
	let date = from.slice(0, 10);
	for (let i = 0; i < MAX_DAYS && date <= to.slice(0, 10); i++) {
		for (const meal of meals) {
			const serveAt = `${date}T${meal.padStart(5, "0")}`;
			if (serveAt < from || serveAt > to) continue;
			const candidate = tryServeAt(input, context, serveAt);
			(candidate.ok ? found : rejected).push(candidate);
		}
		date = addDays(date, 1);
	}
	found.sort(
		(a, b) =>
			a.adjustments - b.adjustments ||
			a.passages - b.passages ||
			a.serveAt.localeCompare(b.serveAt),
	);
	return { candidates: found.slice(0, options.limit ?? 5), rejected };
}

export interface EarliestServe {
	/** The first serving time that can be followed, when one was found in the horizon. */
	found?: ServeCandidate;
	/** The last time tried, local: where the search stopped. */
	searchedUntil: string;
}

/**
 * The first serving time that works if the cook starts now, to the next five
 * minutes. It begins at the recipe's shortest length after the present, so it
 * never tries a time before which nothing could be done, and gives up after
 * `EARLIEST_SERVE_HORIZON_DAYS`.
 */
export function earliestServe(
	input: ProjectionInput,
	context: ProjectionContext,
	options: { from?: string } = {},
): EarliestServe {
	const origin = options.from ?? context.now;
	if (origin === undefined) {
		throw new RangeError(
			"earliestServe needs the present: context.now or from",
		);
	}
	const { timeZone } = context;
	const now = parseInstant(origin, timeZone);
	const shortest = layout(input.graph, {
		...input.options,
		rests: "shortest",
		restOverrides: undefined,
	}).schedule.totalTime;
	const step = SEARCH_STEP_MINUTES;
	let at = Math.ceil((now + Math.max(0, shortest)) / step) * step;
	const limit = now + EARLIEST_SERVE_HORIZON_DAYS * 1440;
	let last = at;
	for (; at <= limit; at += step) {
		last = at;
		const serveAt = toLocalIso(at, timeZone);
		const candidate = tryServeAt(input, { ...context, now: origin }, serveAt);
		if (candidate.ok) return { found: candidate, searchedUntil: serveAt };
	}
	return { searchedUntil: toLocalIso(last, timeZone) };
}

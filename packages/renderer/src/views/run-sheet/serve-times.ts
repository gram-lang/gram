import { fillTemplate, getDictionary } from "@gram-lang/i18n";
import {
	EARLIEST_SERVE_HORIZON_DAYS,
	type EarliestServe,
	type ServeCandidate,
	type ServeSearch,
	parseInstant,
	toLocalIso,
} from "@gram-lang/scheduler";
import type { ViewInput } from "../../prepare-views";
import { longDate, shortDay } from "./dates";
import { describeProblems } from "./model";
import type { RunSheetRenderOptions } from "./model";
import type { RenderableCompilationResult } from "../../types";

/** "Saturday, October 17 at 20:00" */
const whenOf = (local: string, lang?: string) =>
	`${longDate(local, lang)} ${local.slice(11, 16)}`;

/** "Thu 19:55" */
const startOf = (local: string, lang?: string) =>
	`${shortDay(local, lang)} ${local.slice(11, 16)}`;

/** One candidate in a sentence: when, when to start, how much of the kitchen, what was adjusted. */
function candidateLine(
	c: ServeCandidate,
	data: RenderableCompilationResult,
	options: RunSheetRenderOptions & { timeZone: string },
): string {
	const t = getDictionary(options.lang).renderer;
	const lang = options.lang;
	const when = whenOf(c.serveAt, lang);
	if (c.ok) {
		const visits = fillTemplate(
			c.visits === 1 ? t.runSheetVisits : t.runSheetVisitsMany,
			{ n: String(c.visits) },
		);
		const adjusted =
			c.adjustments === 0
				? t.runSheetNoAdjustment
				: fillTemplate(
						c.adjustments === 1 ? t.runSheetAdjusted : t.runSheetAdjustedMany,
						{ n: String(c.adjustments) },
					);
		return fillTemplate(t.runSheetFindOk, {
			when,
			start: c.startsAt ? startOf(c.startsAt, lang) : "",
			visits,
			adjusted,
		});
	}
	const past = c.reasons.some((r) => r.code === "START_IN_PAST");
	const reason =
		past && c.startsAt
			? fillTemplate(t.runSheetFindStart, { start: startOf(c.startsAt, lang) })
			: describeProblems(c.reasons, data, options, options.timeZone).reduce(
					(text, line, i, all) =>
						i > 0
							? text
							: all.length > 1
								? `${line} (+${all.length - 1})`
								: line,
					"",
				);
	return fillTemplate(t.runSheetFindRejected, { when, reason });
}

/**
 * The result of `findServeTimes` in words: the serving times that work, best
 * first, then those that don't, each with why ("You would have to start
 * Thursday").
 */
export function describeServeTimes(
	search: ServeSearch,
	data: RenderableCompilationResult,
	options: RunSheetRenderOptions & {
		timeZone: string;
		from: string;
		to: string;
	},
): string[] {
	const t = getDictionary(options.lang).renderer;
	if (search.candidates.length === 0 && search.rejected.length === 0) {
		return [
			fillTemplate(t.runSheetFindNone, { from: options.from, to: options.to }),
		];
	}
	return [
		...search.candidates.map((c) => candidateLine(c, data, options)),
		...search.rejected.map((c) => candidateLine(c, data, options)),
	];
}

/** The answer of `earliestServe`, in one sentence. */
export function describeEarliestServe(
	result: EarliestServe,
	options: RunSheetRenderOptions = {},
): string {
	const t = getDictionary(options.lang).renderer;
	if (result.found) {
		return fillTemplate(t.runSheetEarliest, {
			when: whenOf(result.found.serveAt, options.lang),
		});
	}
	return fillTemplate(t.runSheetEarliestNone, {
		days: String(EARLIEST_SERVE_HORIZON_DAYS),
		until: whenOf(result.searchedUntil, options.lang),
	});
}

/** A serving time to propose: when, its short label, and why it works. */
export interface ServeSuggestion {
	/** A local date-time, "2026-10-11T13:00", in the kitchen's time zone. */
	serveAt: string;
	/** "Sat 17 Oct, 20:00". */
	label: string;
	/** The sentence of `describeServeTimes` for it. */
	title: string;
}

/** What a surface proposes next to its serving time field. */
export interface ServeSuggestions {
	/** The serving times that work, best first. */
	candidates: ServeSuggestion[];
	/** Why each of the others does not, in words. */
	rejected: string[];
	/** The first time it can be ready if the cook starts now, or `null`. */
	earliest: { serveAt: string; label: string; text: string } | null;
}

export interface SuggestServeOptions {
	lang?: string;
	/** How many days ahead to try, from today. Default 7. */
	days?: number;
	/** How many working times to propose. Default 6. */
	limit?: number;
	/** The times of day to try. Default the scheduler's (12:30, 20:00). */
	mealTimes?: string[];
}

/** "Sat 17 Oct, 20:00", in the reader's language. */
function shortLabel(serveAt: string, lang?: string): string {
	return new Intl.DateTimeFormat(lang || "en", {
		timeZone: "UTC",
		weekday: "short",
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).format(new Date(`${serveAt}:00Z`));
}

function addDays(date: string, days: number): string {
	const [y, m, d] = date.split("-").map(Number) as [number, number, number];
	return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * The serving times to propose for a prepared recipe, in words: those that
 * work over the next days at the meal times, best first, why the others do
 * not, and the earliest from now. The same for every surface that suggests a
 * serving time (the playground, the editor's run sheet). `null` without a
 * kitchen or without anything to schedule.
 */
export function suggestServeTimes(
	input: ViewInput,
	options: SuggestServeOptions = {},
): ServeSuggestions | null {
	const kitchen = input.kitchen;
	const tasks = (input.recipe.tasks as { tasks?: unknown[] } | undefined)
		?.tasks;
	if (!kitchen || !input.projection || !tasks?.length) return null;
	const { timeZone } = kitchen;
	const now = kitchen.now ?? new Date().toISOString();
	const today = toLocalIso(parseInstant(now, timeZone), timeZone).slice(0, 10);
	const range = { from: today, to: addDays(today, options.days ?? 7) };
	const search = input.findServeTimes({
		...range,
		limit: options.limit ?? 6,
		...(options.mealTimes && { mealTimes: options.mealTimes }),
	});
	const earliest = input.earliestServe();
	if (!search || !earliest) return null;
	const lang = options.lang ?? input.lang;
	const words = describeServeTimes(search, input.recipe, {
		...range,
		timeZone,
		...(lang !== undefined && { lang }),
	});
	return {
		candidates: search.candidates.map((c, i) => ({
			serveAt: c.serveAt,
			label: shortLabel(c.serveAt, lang),
			title: words[i] ?? "",
		})),
		rejected: words.slice(search.candidates.length),
		earliest: earliest.found
			? {
					serveAt: earliest.found.serveAt,
					label: shortLabel(earliest.found.serveAt, lang),
					text: describeEarliestServe(earliest, {
						...(lang !== undefined && { lang }),
					}),
				}
			: null,
	};
}

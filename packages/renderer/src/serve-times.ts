import { getDictionary } from "@gram-lang/i18n";
import {
	EARLIEST_SERVE_HORIZON_DAYS,
	type EarliestServe,
	type ServeCandidate,
	type ServeSearch,
} from "@gram-lang/scheduler";
import { describeProblems } from "./run-sheet";
import type { RunSheetRenderOptions } from "./run-sheet";
import type { RenderableCompilationResult } from "./types";

const fill = (template: string, values: Record<string, string>) =>
	template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? `{${k}}`);

const dayName = (local: string, lang: string | undefined, long: boolean) =>
	new Intl.DateTimeFormat(lang || "en", {
		timeZone: "UTC",
		weekday: long ? "long" : "short",
		...(long && { day: "numeric", month: "long" }),
	}).format(
		Date.UTC(
			Number(local.slice(0, 4)),
			Number(local.slice(5, 7)) - 1,
			Number(local.slice(8, 10)),
			12,
		),
	);

/** "Saturday, October 17 at 20:00" */
const whenOf = (local: string, lang?: string) =>
	`${dayName(local, lang, true)} ${local.slice(11, 16)}`;

/** "Thu 19:55" */
const startOf = (local: string, lang?: string) =>
	`${dayName(local, lang, false)} ${local.slice(11, 16)}`;

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
		const visits = fill(
			c.visits === 1 ? t.workPlanVisits : t.workPlanVisitsMany,
			{ n: String(c.visits) },
		);
		const adjusted =
			c.adjustments === 0
				? t.workPlanNoAdjustment
				: fill(
						c.adjustments === 1 ? t.workPlanAdjusted : t.workPlanAdjustedMany,
						{ n: String(c.adjustments) },
					);
		return fill(t.workPlanFindOk, {
			when,
			start: c.startsAt ? startOf(c.startsAt, lang) : "",
			visits,
			adjusted,
		});
	}
	const past = c.reasons.some((r) => r.code === "START_IN_PAST");
	const reason =
		past && c.startsAt
			? fill(t.workPlanFindStart, { start: startOf(c.startsAt, lang) })
			: describeProblems(c.reasons, data, options, options.timeZone).reduce(
					(text, line, i, all) =>
						i > 0
							? text
							: all.length > 1
								? `${line} (+${all.length - 1})`
								: line,
					"",
				);
	return fill(t.workPlanFindRejected, { when, reason });
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
		return [fill(t.workPlanFindNone, { from: options.from, to: options.to })];
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
		return fill(t.workPlanEarliest, {
			when: whenOf(result.found.serveAt, options.lang),
		});
	}
	return fill(t.workPlanEarliestNone, {
		days: String(EARLIEST_SERVE_HORIZON_DAYS),
		until: whenOf(result.searchedUntil, options.lang),
	});
}

import {
	describeEarliestServe,
	describeRunSheet,
	describeServeTimes,
	escapeHtml,
	runSheetToHTML,
	runSheetToMarkdown,
	runSheetToText,
} from "@gram-lang/renderer";
import {
	type CompilationResult,
	type MiseEnPlaceMode,
	type RestChoice,
	scheduleFor,
} from "@gram-lang/kitchen";
import {
	type Availability,
	type EarliestServe,
	type ProjectedPlan,
	type ProjectionContext,
	type ProjectionInput,
	type RunSheet,
	type ServeCandidate,
	earliestServe,
	findServeTimes,
	project,
	runSheet,
} from "@gram-lang/scheduler";
import { runPipeline } from "../core/pipeline";
import { buildICS } from "./ics";

export type PlanFormat = "text" | "md" | "html" | "json";
export const PLAN_FORMATS: readonly PlanFormat[] = [
	"text",
	"md",
	"html",
	"json",
];

export interface PlanOptions {
	/** A local date and time, "2026-10-11T13:00". Without it, the plan has no dates. */
	serveAt?: string;
	timeZone: string;
	availability: Availability;
	/** The present, for the warning about a start already behind, and the earliest time. */
	now?: string;
	miseEnPlace?: MiseEnPlaceMode;
	rests?: RestChoice;
	scaleFactor?: number;
	lang?: string;
	paths?: Record<string, string>;
	stock?: Set<string>;
}

export interface PlanResult {
	compiled: CompilationResult;
	/** Present with a serving time. */
	plan?: ProjectedPlan;
	sheet: RunSheet;
	usedStock: Set<string>;
	/** What the plan was made from, to look for other serving times. */
	input: ProjectionInput;
	context: ProjectionContext;
	/** The first serving time that works if the cook starts now, for a plan without one. */
	earliest?: EarliestServe;
}

/**
 * Compiles a recipe and lays it out: on the calendar, ending when it is
 * served, or, with no serving time, as the days before it and the earliest it
 * could be ready.
 */
export async function planRecipe(
	filePath: string,
	options: PlanOptions,
): Promise<PlanResult> {
	const { compiled, usedStock } = await runPipeline(filePath, {
		skipAnalyzer: true,
		scaleFactor: options.scaleFactor,
		lang: options.lang,
		paths: options.paths,
		stock: options.stock,
	});
	const input: ProjectionInput = {
		graph: compiled.tasks,
		title: compiled.title ?? undefined,
		options: { miseEnPlace: options.miseEnPlace, rests: options.rests },
	};
	const context: ProjectionContext = {
		// Replaced by every serving time tried; only a plan with one reads it.
		serveAt: options.serveAt ?? "1970-01-01T00:00",
		timeZone: options.timeZone,
		availability: options.availability,
		...(options.now !== undefined && { now: options.now }),
	};
	if (options.serveAt === undefined) {
		const schedule = scheduleFor(compiled, options.miseEnPlace, options.rests);
		const sheet = runSheet(schedule!, {
			graph: compiled.tasks,
			...(compiled.title && { title: compiled.title }),
		});
		const earliest = earliestServe(input, {
			...context,
			now: context.now ?? new Date().toISOString(),
		});
		return { compiled, sheet, usedStock, input, context, earliest };
	}
	const plan = project([input], context);
	const sheet = runSheet(plan, { graph: compiled.tasks, context });
	return { compiled, plan, sheet, usedStock, input, context };
}

/** The sheet in one of the formats `--format` offers. */
export function formatPlan(
	result: PlanResult,
	format: PlanFormat,
	lang?: string,
): string {
	const { compiled, plan, sheet, earliest } = result;
	const sentence = earliest
		? describeEarliestServe(earliest, { lang })
		: undefined;
	switch (format) {
		case "text":
			return `${runSheetToText(sheet, compiled, { lang })}${sentence ? `\n${sentence}\n` : ""}`;
		case "md":
			return `${runSheetToMarkdown(sheet, compiled, { lang })}${sentence ? `\n${sentence}\n` : ""}`;
		case "html":
			return `${runSheetToHTML(sheet, compiled, { lang })}${sentence ? `<p class="work-plan-earliest">${escapeHtml(sentence)}</p>\n` : ""}`;
		case "json":
			return `${JSON.stringify(
				{
					...(plan && { plan }),
					runSheet: sheet,
					...(earliest && {
						earliest: {
							...(earliest.found && { serveAt: earliest.found.serveAt }),
							searchedUntil: earliest.searchedUntil,
						},
					}),
				},
				null,
				2,
			)}\n`;
	}
}

/** The serving times worth proposing between two moments, with the reasons of the others. */
export function findPlan(
	result: PlanResult,
	range: { from: string; to: string },
	format: "text" | "md" | "json",
	options: { mealTimes?: string[]; lang?: string },
): string {
	const search = findServeTimes(result.input, result.context, {
		...range,
		...(options.mealTimes && { mealTimes: options.mealTimes }),
	});
	if (format === "json") {
		const slim = ({ plan: _plan, ...rest }: ServeCandidate) => rest;
		return `${JSON.stringify(
			{
				candidates: search.candidates.map(slim),
				rejected: search.rejected.map(slim),
			},
			null,
			2,
		)}\n`;
	}
	const lines = describeServeTimes(search, result.compiled, {
		...range,
		timeZone: result.context.timeZone,
		lang: options.lang,
	});
	return `${lines.map((l) => (format === "md" ? `- ${l}` : l)).join("\n")}\n`;
}

/** The work plan as an iCalendar file, every event stamped `stamp` (an ISO instant, UTC). */
export function planToICS(
	result: PlanResult,
	stamp: string,
	lang?: string,
): string {
	return buildICS(describeRunSheet(result.sheet, result.compiled, { lang }), {
		stamp,
	});
}

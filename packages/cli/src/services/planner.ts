import {
	type CommentsMode,
	describeEarliestServe,
	describeRunSheet,
	describeServeTimes,
	escapeHtml,
	getView,
	prepareViews,
	type ViewInput,
} from "@gram-lang/renderer";
import type {
	CompilationResult,
	MiseEnPlaceMode,
	RestChoice,
} from "@gram-lang/kitchen";
import {
	type Availability,
	type EarliestServe,
	type ProjectedPlan,
	type ProjectionContext,
	type ProjectionInput,
	type RunSheet,
	type ServeCandidate,
	findServeTimes,
} from "@gram-lang/scheduler";
import { runPipeline } from "../core/pipeline";
import { ExitCode, GramCLIError } from "../errors";
import { buildICS } from "./ics";
import {
	PLAN_SHEET_FORMATS,
	cliFormatsOf,
	resolveCliFormat,
} from "../core/cli-views";

// The work plan, as the renderer's registry describes it.
const workPlanView = getView("workPlan");
if (!workPlanView) throw new Error("The renderer has no work plan view.");
const WORK_PLAN = workPlanView;

/**
 * `--format` of `gram plan`: the work plan's formats the command offers, read
 * from the registry, then `json`, the data of the plan rather than a view.
 */
export type PlanFormat = string;
export const PLAN_FORMATS: readonly PlanFormat[] = [
	...cliFormatsOf(WORK_PLAN, PLAN_SHEET_FORMATS),
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
	comments?: CommentsMode;
	scaleFactor?: number;
	lang?: string;
	paths?: Record<string, string>;
	stock?: Set<string>;
}

export interface PlanResult {
	compiled: CompilationResult;
	/** What the views are written from: the settings, the kitchen, the plan. */
	views: ViewInput;
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
	const views = prepareViews(
		compiled,
		{
			miseEnPlace: options.miseEnPlace,
			rests: options.rests,
			comments: options.comments,
		},
		{
			...(options.lang !== undefined && { lang: options.lang }),
			kitchen: {
				timeZone: options.timeZone,
				availability: options.availability,
				...(options.now !== undefined && { now: options.now }),
			},
			...(options.serveAt !== undefined && { serveAt: options.serveAt }),
		},
	);
	const sheet = views.runSheet;
	if (!sheet || !views.projection) {
		throw new GramCLIError("This recipe has nothing to plan.", ExitCode.Error);
	}
	const { input, context } = views.projection;
	if (options.serveAt === undefined) {
		const earliest = views.earliestServe() ?? undefined;
		return { compiled, views, sheet, usedStock, input, context, earliest };
	}
	const plan = views.plan ?? undefined;
	return { compiled, views, plan, sheet, usedStock, input, context };
}

/** The sheet in one of the formats `--format` offers. */
export function formatPlan(
	result: PlanResult,
	format: PlanFormat,
	lang?: string,
): string {
	const { plan, sheet, earliest } = result;
	const sentence = earliest
		? describeEarliestServe(earliest, { lang })
		: undefined;
	if (format !== "json") {
		const written =
			WORK_PLAN.render(
				result.views,
				resolveCliFormat(WORK_PLAN, format, PLAN_SHEET_FORMATS),
				{ ...(lang !== undefined && { lang }) },
			) ?? "";
		if (!sentence) return written;
		return format === "html"
			? `${written}<p class="work-plan-earliest">${escapeHtml(sentence)}</p>\n`
			: `${written}\n${sentence}\n`;
	}
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

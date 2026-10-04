import {
	describeRunSheet,
	runSheetToHTML,
	runSheetToMarkdown,
	runSheetToText,
} from "@gram-lang/renderer";
import type {
	CompilationResult,
	MiseEnPlaceMode,
	RestChoice,
} from "@gram-lang/kitchen";
import {
	type Availability,
	type ProjectedPlan,
	type RunSheet,
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
	/** A local date and time, "2026-10-11T13:00". */
	serveAt: string;
	timeZone: string;
	availability: Availability;
	/** The present, for the warning about a start already behind. */
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
	plan: ProjectedPlan;
	sheet: RunSheet;
	usedStock: Set<string>;
}

/** Compiles a recipe and places it on the calendar, ending when it is served. */
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
	const plan = project(
		[
			{
				graph: compiled.tasks,
				title: compiled.title ?? undefined,
				options: { miseEnPlace: options.miseEnPlace, rests: options.rests },
			},
		],
		{
			serveAt: options.serveAt,
			timeZone: options.timeZone,
			availability: options.availability,
			...(options.now !== undefined && { now: options.now }),
		},
	);
	return { compiled, plan, sheet: runSheet(plan), usedStock };
}

/** The sheet in one of the formats `--format` offers. */
export function formatPlan(
	result: PlanResult,
	format: PlanFormat,
	lang?: string,
): string {
	const { compiled, plan, sheet } = result;
	switch (format) {
		case "text":
			return runSheetToText(sheet, compiled, { lang });
		case "md":
			return runSheetToMarkdown(sheet, compiled, { lang });
		case "html":
			return runSheetToHTML(sheet, compiled, { lang });
		case "json":
			return `${JSON.stringify({ plan, runSheet: sheet }, null, 2)}\n`;
	}
}

/** The sheet as an iCalendar file, every event stamped `stamp` (an ISO instant, UTC). */
export function planToICS(
	result: PlanResult,
	stamp: string,
	lang?: string,
): string {
	return buildICS(describeRunSheet(result.sheet, result.compiled, { lang }), {
		stamp,
	});
}

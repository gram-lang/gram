import type {
	ProjectedBlock,
	ProjectedPlan,
	ProjectionDiagnostic,
	RestAdjustment,
} from "./projection";
import { daysBetween } from "./time";

/** One line of the production sheet: a task, when it starts and ends, for how long. */
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
	/** ISO instants, UTC. */
	start: string;
	end: string;
	/** The wall clock of the plan's time zone, exact to the minute: rounding is for display. */
	startLocal: string;
	endLocal: string;
	minutes: number;
	/** Set when the plan made this rest longer or shorter, and why. */
	adjustment?: RestAdjustment;
}

/** What happens on one calendar day, in order. */
export interface RunSheetDay {
	/** "2026-10-10" */
	date: string;
	/** Days before the service: 0 on the day itself. */
	daysBefore: number;
	entries: RunSheetEntry[];
}

export interface RunSheet {
	serveAt: string;
	timeZone: string;
	recipes: { title?: string; days: RunSheetDay[] }[];
	/** Everything the plan could not make right. */
	diagnostics: ProjectionDiagnostic[];
}

/**
 * The structure of a production sheet: for each recipe, the days, and for each
 * day its tasks in the order they happen. Words and layout belong to the
 * renderer; nothing here is rounded or translated.
 */
export function runSheet(plan: ProjectedPlan): RunSheet {
	const adjustments = new Map(plan.adjustments.map((a) => [a.task, a]));
	const serveDate = plan.serveAt.slice(0, 10);
	return {
		serveAt: plan.serveAt,
		timeZone: plan.timeZone,
		diagnostics: plan.diagnostics,
		recipes: plan.recipes.map((recipe) => {
			const byDate = new Map<string, RunSheetEntry[]>();
			const ordered = [...recipe.blocks].sort(
				(a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end),
			);
			for (const block of ordered) {
				const entry: RunSheetEntry = {
					task: block.task,
					kind: block.kind,
					active: block.kind !== "passive",
					section: block.section,
					...("step" in block && { step: block.step }),
					...("track" in block &&
						block.track !== undefined && { track: block.track }),
					start: block.start,
					end: block.end,
					startLocal: block.startLocal,
					endLocal: block.endLocal,
					minutes: (Date.parse(block.end) - Date.parse(block.start)) / 60000,
					...(adjustments.has(block.task) && {
						adjustment: adjustments.get(block.task)!,
					}),
				};
				const date = block.startLocal.slice(0, 10);
				const list = byDate.get(date);
				if (list) list.push(entry);
				else byDate.set(date, [entry]);
			}
			return {
				...(recipe.title !== undefined && { title: recipe.title }),
				days: [...byDate.entries()].map(([date, entries]) => ({
					date,
					daysBefore: daysBetween(date, serveDate),
					entries,
				})),
			};
		}),
	};
}

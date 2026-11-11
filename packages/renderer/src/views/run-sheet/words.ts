import { fillTemplate, getDictionary } from "@gram-lang/i18n";
import type { RunSheetDay, RunSheetThread } from "@gram-lang/scheduler";
import { workingDayLabel } from "../../shared/mise-en-place";
import { durationFormatter } from "../../shared/utils";
import type { RenderableCompilationResult } from "../../types";
import type { RunSheetRenderOptions } from "./model";

const pad = (n: number) => String(n).padStart(2, "0");

/** "21:38" shown as "21:40": the calculation stays to the minute, only the display rounds. */
export function roundedClock(local: string, step: number): string {
	const minutes =
		Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
	const rounded = (Math.round(minutes / step) * step) % 1440;
	return `${pad(Math.floor(rounded / 60))}:${pad(rounded % 60)}`;
}

/** What a rest is called: its track, else the action of its step, else "Rest". */
export const restName = (
	fallback: string,
	track: string | undefined,
	action: string | undefined,
) =>
	track !== undefined
		? track.charAt(0).toUpperCase() + track.slice(1)
		: action || fallback;

export const plural = (n: number, one: string, many: string) =>
	fillTemplate(n === 1 ? one : many, { n: String(n) });

/** A task of the recipe's task graph, as the compiled recipe carries it. */
export type RunSheetTask = NonNullable<
	RenderableCompilationResult["tasks"]
>["tasks"][number];

/**
 * The words and the clock of a run sheet, built once from the sheet, the recipe
 * and the options: how a section, a wait, a day or a time is told. What they
 * say comes from the dictionary and from the scheduler's figures; here is only
 * the wording and the rounding.
 */
export interface RunSheetWords {
	/** The `renderer` words of the dictionary, in the language asked for. */
	t: ReturnType<typeof getDictionary>["renderer"];
	lang: string | undefined;
	/** True for a plan on the calendar (a serving time), false for days before the service. */
	calendar: boolean;
	fmt: (minutes: number) => string;
	/** The tasks of the recipe by id. */
	tasks: Map<string, RunSheetTask>;
	sectionTitle: (index: number) => string;
	stepAction: (
		section: number,
		index: number | undefined,
	) => string | undefined;
	/** "Dough : Fridge" */
	waitName: (w: { section: number; step?: number; track?: string }) => string;
	/** A local date-time as a clock, to the nearest minutes of the rounding. */
	clock: (local: string) => string;
	/** A length rounded for display, never below the rounding step. */
	rounded: (minutes: number) => number;
	dayLabel: (day: RunSheetDay) => string;
	/** The written range of a wait, when its task is one. */
	rangeOf: (id: string) => { min: number; max: number } | undefined;
	rangeText: (range: { min: number; max: number }) => string;
	/** The name and the planned length of a wait, with the written range when it differs. */
	threadParts: (thread: RunSheetThread) => { name: string; length: string };
	/** "Insert : Freeze 12 to 72 h" */
	threadText: (thread: RunSheetThread, until?: string) => string;
}

export function runSheetWords(
	data: RenderableCompilationResult,
	options: RunSheetRenderOptions,
	calendar: boolean,
): RunSheetWords {
	const t = getDictionary(options.lang).renderer;
	const step = options.roundTo && options.roundTo > 0 ? options.roundTo : 5;
	const fmt = durationFormatter(options);
	const tasks = new Map((data.tasks?.tasks ?? []).map((x) => [x.id, x]));

	const sectionTitle = (index: number) =>
		data.sections?.[index]?.title || t.runSheetUnnamedSection;
	const stepAction = (section: number, index: number | undefined) => {
		if (index === undefined) return undefined;
		const s = data.sections?.[section]?.steps[index];
		return s?.type === "step" ? s.action : undefined;
	};
	const waitName = (w: { section: number; step?: number; track?: string }) =>
		`${sectionTitle(w.section)} : ${restName(t.runSheetRest, w.track, stepAction(w.section, w.step))}`;
	const rangeOf = (id: string) => {
		const task = tasks.get(id);
		if (task?.kind !== "passive") return undefined;
		const { min, max } = task.duration;
		return min !== undefined && max !== undefined && min < max
			? { min, max }
			: undefined;
	};
	const rangeText = (r: { min: number; max: number }) =>
		fillTemplate(t.runSheetRange, { min: fmt(r.min), max: fmt(r.max) });

	const threadParts = (
		th: RunSheetThread,
	): { name: string; length: string } => {
		const name = waitName(th);
		const planned = Math.round(th.planned);
		const range = th.range ?? rangeOf(th.task);
		let length: string;
		if (range && Math.abs(th.planned - range.min) < 1) {
			length = rangeText(range);
		} else if (range) {
			length = `${fmt(planned)} (${rangeText(range)})`;
		} else {
			length = fmt(planned);
		}
		return { name, length };
	};
	const threadText = (th: RunSheetThread, until?: string) => {
		const { name, length } = threadParts(th);
		return `${name} ${length}${until ? `, ${until}` : ""}`;
	};

	return {
		t,
		lang: options.lang,
		calendar,
		fmt,
		tasks,
		sectionTitle,
		stepAction,
		waitName,
		clock: (local) => roundedClock(local, step),
		rounded: (minutes) => Math.max(step, Math.round(minutes / step) * step),
		dayLabel: (day) => workingDayLabel(day.daysBefore, t),
		rangeOf,
		rangeText,
		threadParts,
		threadText,
	};
}

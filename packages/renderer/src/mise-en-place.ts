import {
	type MiseEnPlaceItem,
	type ScheduleBlock,
	type MiseEnPlaceMode,
	type RestChoice,
	type SectionMiseEnPlace,
	scheduleFor,
	scheduleTimes,
} from "@gram-lang/kitchen";
import type { RenderableCompilationResult } from "./types";

/** Which timeline a view follows: where the mise en place goes, and how long the rests written as a range last. */
export interface TimelineChoice {
	miseEnPlace?: MiseEnPlaceMode;
	rests?: RestChoice;
}

/**
 * The total and idle time to show: those of the timeline the options choose,
 * laid out from the recipe's task graph. The same as the time boxes of the
 * recipe: mise en place, active, waiting, total.
 */
export function timesOf(
	data: RenderableCompilationResult,
	options: TimelineChoice,
): { totalTime: number; idleTime: number } {
	return scheduleTimes(data, options.miseEnPlace, options.rests);
}

/** The timeline of a choice, laid out from the recipe's task graph. */
export const timelineOf = (
	data: RenderableCompilationResult,
	choice: TimelineChoice,
) => scheduleFor(data, choice.miseEnPlace, choice.rests);

/** What preparing section `index` costs, when it costs anything. */
export function miseEnPlaceForSection(
	data: RenderableCompilationResult,
	index: number,
): SectionMiseEnPlace | undefined {
	return data.miseEnPlace?.find((m) => m.section === index);
}

interface Labels {
	ingredientsOverhead: string;
	cookwareOverhead: string;
	breakdownPrep: string;
	colon: string;
}

/**
 * Plain-text (not escaped) description of one line of a section's mise en
 * place — callers escape it for their own output format. Names come from the
 * registry, never from a parsed label.
 *
 * A preparation says how long it takes unless `showDuration` is false, for the
 * callers that print the duration in a column of their own.
 */
export function describeMiseEnPlaceItem(
	item: MiseEnPlaceItem,
	registry: RenderableCompilationResult["registry"] | undefined,
	labels: Labels,
	formatDuration: (minutes: number) => string,
	{ showDuration = true }: { showDuration?: boolean } = {},
): string {
	if (item.kind === "gather") {
		const label =
			item.target === "ingredient"
				? labels.ingredientsOverhead
				: labels.cookwareOverhead;
		return `${label} (${item.count} × ${formatDuration(item.duration / item.count)})`;
	}
	const entry =
		item.ref.type === "cookware"
			? registry?.cookware?.[item.ref.id]
			: registry?.ingredients?.[item.ref.id];
	const name = entry?.name ?? item.ref.id;
	const prepared = `${labels.breakdownPrep}${labels.colon}${name}`;
	return showDuration
		? `${prepared} (+ ${formatDuration(item.duration)})`
		: prepared;
}

/**
 * The mise en place items a `prep` block stands for: the part it carries when
 * the section's was split, else the whole entry of its section.
 */
export function prepItems(
	data: RenderableCompilationResult,
	block: Extract<ScheduleBlock, { kind: "prep" }>,
): MiseEnPlaceItem[] {
	return block.items ?? miseEnPlaceForSection(data, block.section)?.items ?? [];
}

/** The label of a working day: "D-3", or "Day D" for the day itself. */
export const workingDayLabel = (
	day: number,
	labels: { dayBefore: string; dayToday: string },
): string => (day === 0 ? labels.dayToday : `${labels.dayBefore}${day}`);

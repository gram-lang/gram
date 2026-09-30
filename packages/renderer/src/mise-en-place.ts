import {
	DEFAULT_SCHEDULE_MODE,
	type MiseEnPlaceItem,
	type Schedule,
	type ScheduleMode,
	type SectionMiseEnPlace,
	scheduleFor,
} from "@gram-lang/kitchen";
import type { RenderableCompilationResult } from "./types";

/** True when each section carries its own preparation (the default). */
export const isPerSection = (mode: ScheduleMode | undefined): boolean =>
	(mode ?? DEFAULT_SCHEDULE_MODE) === "perSection";

/**
 * The timeline the reader picked. Undefined for a result that carries no
 * `schedules` (e.g. JSON produced by an older kitchen): the callers then
 * simply skip what depends on it instead of crashing.
 */
export function resolveSchedule(
	data: RenderableCompilationResult,
	mode?: ScheduleMode,
): Schedule | undefined {
	return scheduleFor(data, mode);
}

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

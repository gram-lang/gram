import type {
	MiseEnPlaceItem,
	Schedule,
	SectionMiseEnPlace,
} from "@gram-lang/kitchen";
import type { RenderableCompilationResult, ScheduleMode } from "./types";

/** Preparation right before each section, unless the reader picks otherwise. */
export const DEFAULT_SCHEDULE: ScheduleMode = "perSection";

/** True when each section carries its own preparation (the default). */
export const isPerSection = (mode: ScheduleMode | undefined): boolean =>
	(mode ?? DEFAULT_SCHEDULE) === "perSection";

/**
 * The timeline the reader picked. Undefined for a result that carries no
 * `schedules` (e.g. JSON produced by an older kitchen): the callers then
 * simply skip what depends on it instead of crashing.
 */
export function resolveSchedule(
	data: RenderableCompilationResult,
	mode: ScheduleMode = DEFAULT_SCHEDULE,
): Schedule | undefined {
	return data.schedules?.[mode];
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
}

/**
 * Plain-text (not escaped) description of one line of a section's mise en
 * place — callers escape it for their own output format. Names come from the
 * registry, never from a parsed label.
 */
export function describeMiseEnPlaceItem(
	item: MiseEnPlaceItem,
	registry: RenderableCompilationResult["registry"] | undefined,
	labels: Labels,
	formatDuration: (minutes: number) => string,
): string {
	if (item.kind === "gather") {
		const label =
			item.target === "ingredient"
				? labels.ingredientsOverhead
				: labels.cookwareOverhead;
		return `${label} (${item.count} × 1min)`;
	}
	const entry =
		item.ref.type === "cookware"
			? registry?.cookware?.[item.ref.id]
			: registry?.ingredients?.[item.ref.id];
	const name = entry?.name ?? item.ref.id;
	return `${labels.breakdownPrep} : ${name} (+ ${formatDuration(item.duration)})`;
}

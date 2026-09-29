import type {
	AggregatedIngredient,
	MiseEnPlaceItem,
	Schedule,
	SectionMiseEnPlace,
	Usage,
} from "@gram-lang/kitchen";
import { aggregateSectionIngredients } from "@gram-lang/kitchen";
import type { RenderableCompilationResult, ScheduleMode } from "./types";
import { aggToRendererItem } from "./utils";

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

const hasPreparation = (u: Usage): boolean =>
	Boolean(u.preparation || u.composite?.preparation) ||
	(Array.isArray(u.options) &&
		u.options.some(
			(o) =>
				typeof o === "object" &&
				Boolean(
					(o as Usage).preparation || (o as Usage).composite?.preparation,
				),
		));

/**
 * Everything that has to be prepared, gathered from every section, for the
 * "all at the start" block. References (intermediates and module bindings)
 * are left out: they don't exist yet at T0. Same aggregation and item shape
 * as a section's own ingredient list, so it formats and scales the same way.
 */
export function upfrontPreparationItems(
	data: RenderableCompilationResult,
): Array<Record<string, unknown>> {
	const usages: Usage[] = [];
	for (const sec of data.sections) {
		for (const u of sec.ingredients ?? []) {
			if (u.type === "reference") continue;
			if (hasPreparation(u)) usages.push(u);
		}
	}
	return aggregateSectionIngredients(usages).map((agg: AggregatedIngredient) =>
		aggToRendererItem(agg),
	);
}

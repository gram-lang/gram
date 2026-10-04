import { analyzeMiseEnPlace } from "./mise-en-place";
import type {
	ProcessedSection,
	Registry,
	SectionMiseEnPlace,
	TimeBreakdownItem,
} from "./types";
import { addToBreakdown } from "./utils";

/**
 * Splits the mise en place cost by section. Each registry ingredient/cookware
 * is gathered by the first section that touches it (an id never touched goes
 * to the first section that has steps), and each ingredient `preparation` is
 * charged to the section it appears in. A section without a real step never
 * carries a cost (there would be nothing to schedule it before): its share
 * moves to the first section that has steps, and a recipe with no step at all
 * has no mise en place.
 *
 * Public API, like `calculatePreparationTime`: `compile()` returns its result as
 * `miseEnPlace`, and any `ProcessedSection[]` with its registry (e.g. one you
 * built yourself) can be run through it to get the same split. Its signature
 * is stable; how the cost is split between sections may still be refined in a
 * minor version, the same way a compiler fix is.
 */
export function computeMiseEnPlace(
	sections: ProcessedSection[],
	registry: Registry,
): SectionMiseEnPlace[] {
	return analyzeMiseEnPlace(sections, registry).entries;
}

/**
 * Calculates the total active preparation time (in minutes) for a recipe.
 *
 * Derived from `computeMiseEnPlace`: base lookup overhead (gathering
 * ingredients & cookware) plus active preparation times (e.g. chopping,
 * peeling) declared on ingredients.
 *
 * `mise` is the section split when the caller already has it, so it isn't
 * computed twice.
 */
export function calculatePreparationTime(
	sections: ProcessedSection[],
	registry: Registry,
	mise: SectionMiseEnPlace[] = computeMiseEnPlace(sections, registry),
): {
	total: number;
	/** @deprecated Since 1.4.0, will be removed in 2.0.0. Read the `items` of `computeMiseEnPlace()` instead. (Ref: kitchen-prep-time-breakdown-signature) */
	breakdown: TimeBreakdownItem[];
} {
	const breakdown: TimeBreakdownItem[] = [];

	let ingredients = 0;
	let cookware = 0;
	const prepared: TimeBreakdownItem[] = [];
	for (const entry of mise) {
		for (const item of entry.items) {
			if (item.kind === "gather") {
				if (item.target === "ingredient") ingredients += item.count;
				else cookware += item.count;
			} else {
				addToBreakdown(prepared, `prep_${item.ref.id}`, item.duration);
			}
		}
	}
	// Base overhead: 1 minute per unique ingredient and cookware item
	addToBreakdown(breakdown, "ingredients_overhead", ingredients * 1);
	addToBreakdown(breakdown, "cookware_overhead", cookware * 1);
	breakdown.push(...prepared);

	const total = breakdown.reduce((sum, b) => sum + b.duration, 0);
	// @remove-in: 2.0.0 [kitchen-prep-time-breakdown-signature]
	return { total, breakdown };
}

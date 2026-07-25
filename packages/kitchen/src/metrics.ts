import type {
	ProcessedSection,
	Registry,
	TimeBreakdownItem,
	StepToken,
} from "./types";
import { addToBreakdown } from "./utils";

/**
 * Calculates the total active preparation time (in minutes) for a recipe.
 *
 * Sums base lookup overhead (gathering ingredients & cookware) and adds
 * active preparation times (e.g. chopping, peeling) declared on ingredients.
 */
export function calculatePreparationTime(
	sections: ProcessedSection[],
	registry: Registry,
): { total: number; breakdown: TimeBreakdownItem[] } {
	const breakdown: TimeBreakdownItem[] = [];

	// Base overhead: 1 minute per unique ingredient and cookware item
	if (registry.ingredients.size > 0) {
		addToBreakdown(
			breakdown,
			"ingredients_overhead",
			registry.ingredients.size * 1,
		);
	}
	if (registry.cookware.size > 0) {
		addToBreakdown(breakdown, "cookware_overhead", registry.cookware.size * 1);
	}

	// Tracks the ingredient's stable `id` rather than a display name — the label is
	// resolved to a name via the registry at render time, the same way every other
	// ingredient reference in the compiled output is (shopping list, section lists).
	const countPrep = (
		item: StepToken | undefined,
	): { duration: number; id?: string } => {
		let localTime = 0;
		if (!item || typeof item === "string") return { duration: 0 };

		let itemId = "id" in item ? item.id : undefined;

		const options = "options" in item ? item.options : undefined;
		if (options && Array.isArray(options)) {
			// For alternative choices, take the longest preparation path
			let maxOpt = 0;
			options.forEach((opt) => {
				const res = countPrep(opt);
				if (res.duration > maxOpt) {
					maxOpt = res.duration;
					if (res.id) itemId = res.id;
				}
			});
			localTime += maxOpt;
		} else if (
			!item.type &&
			"id" in item &&
			item.id &&
			"preparation" in item &&
			item.preparation
		) {
			// Audit 2026-07-22, kitchen finding F-016: createCleanUsage never
			// sets `.type` on a plain ingredient, so an `item.type ===
			// "ingredient"` check (removed above) was always dead — this is
			// the only branch that ever actually added the 2min preparation
			// overhead for a non-alternative ingredient.
			localTime += 2;
		}

		return { duration: localTime, id: itemId };
	};

	sections.forEach((sec) => {
		sec.steps.forEach((s) => {
			if (s.type === "step" && s.content) {
				s.content.forEach((c) => {
					const prep = countPrep(c);
					if (prep.duration > 0) {
						addToBreakdown(breakdown, `prep_${prep.id}`, prep.duration);
					}
				});
			}
		});
	});
	const total = breakdown.reduce((sum, b) => sum + b.duration, 0);
	return { total, breakdown };
}

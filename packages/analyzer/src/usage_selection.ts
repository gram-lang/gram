import type { AnalyzedUsage } from "./types";

/**
 * Resolves the usage that actually contributes to a recipe's totals, or null
 * if the item contributes nothing.
 *
 * Two rules, both of which used to be implemented twice — once in `metrics.ts`
 * for the mass totals and once in `nutrition.ts` for the macro totals, with
 * different levels of defensiveness (the nutrition copy cast `options[0]`
 * blind). Having the two totals disagree about what counts as "in" the recipe
 * is what makes a derived figure like kcal per 100 g meaningless, so they read
 * the same rules from here:
 *
 * - An ingredient marked optional (`?`) is excluded, which keeps every total on
 *   the same conservative baseline: the dish as it is when you skip the
 *   garnish.
 * - An alternative group ("egg OR tofu") has no single value of its own, only
 *   whichever option is actually used, so it resolves to the first (preferred)
 *   option. That option can itself be optional, hence the second check.
 */
export function resolveContributingUsage(
	item: AnalyzedUsage,
): AnalyzedUsage | null {
	if (item.modifiers?.includes("optional")) return null;

	let target = item;
	if (item.type === "alternative") {
		const firstOption = item.options?.[0];
		// An alternative's options are ingredient/cookware Usage objects in
		// practice, never a bare string or other StepToken variant — but this
		// is reached with data straight off the shopping list, so it checks
		// rather than asserts.
		if (
			!firstOption ||
			typeof firstOption !== "object" ||
			!("id" in firstOption)
		) {
			return null;
		}
		target = firstOption as AnalyzedUsage;
		if (target.modifiers?.includes("optional")) return null;
	}

	return target;
}

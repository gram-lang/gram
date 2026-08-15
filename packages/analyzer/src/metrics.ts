import type { MassMetrics, AnalyzedUsage } from "./types";
import { resolveContributingUsage } from "./usage_selection";
import { round2 } from "@gram-lang/kitchen";

/**
 * Calculates mass metrics (totals, precision status, and missing data warnings)
 * for a list of ingredient usages by querying their normalized masses.
 */
export function calculateMassMetrics(
	ingredients: AnalyzedUsage[],
): MassMetrics {
	let totalMass = 0;
	const missing: string[] = [];
	let hasEstimates = false;
	let hasPrecise = false;

	ingredients.forEach((item) => {
		// Optional items are excluded and alternatives resolve to their first
		// option — the same rules calculateNutrition() applies, read from the
		// one place that defines them.
		const target = resolveContributingUsage(item);
		if (!target) return;

		if (target.normalizedMass !== undefined) {
			totalMass += target.normalizedMass;
			if (target.isEstimate) hasEstimates = true;
			else hasPrecise = true;
		} else {
			// Log missing physical data for raw, non-functional ingredients
			if (
				target.type !== "cookware" &&
				target.type !== "timer" &&
				target.type !== "temperature" &&
				target.type !== "reference"
			) {
				missing.push(target.name || target.id || "?");
			}
		}
	});

	let status: "precise" | "estimated" | "incomplete" = "precise";
	if (missing.length > 0) status = "incomplete";
	else if (hasEstimates) status = "estimated";
	else if (!hasPrecise && !hasEstimates) status = "incomplete"; // Safe fallback for empty lists

	return {
		totalMass: round2(totalMass),
		massStatus: status,
		missingMassIngredients: missing,
	};
}

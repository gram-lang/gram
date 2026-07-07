import type { MassMetrics } from "./types";

/**
 * Calculates mass metrics (totals, precision status, and missing data warnings)
 * for a list of ingredient usages by querying their normalized masses.
 */
export function calculateMassMetrics(ingredients: any[]): MassMetrics {
	let totalMass = 0;
	const missing: string[] = [];
	let hasEstimates = false;
	let hasPrecise = false;

	ingredients.forEach((item) => {
		// Optional ingredients (`?`) are excluded from totalMass, matching the
		// same conservative-baseline treatment calculateNutrition() applies to
		// calories — otherwise the two totals disagree on what's "in" the
		// recipe and kcal/100g figures become inconsistent.
		if (item.modifiers?.includes("optional")) return;

		// Handle alternatives by picking the first option as the representative mass
		let target = item;
		if (
			item.type === "alternative" &&
			item.options &&
			item.options.length > 0
		) {
			target = item.options[0];
		}
		// A composite child or alternative option can carry its own `optional`
		// modifier even when the parent/group wasn't marked optional as a whole.
		if (target.modifiers?.includes("optional")) return;

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

	// Determine the overall confidence level of the mass calculations
	let status: "precise" | "estimated" | "incomplete" = "precise";
	if (missing.length > 0) status = "incomplete";
	else if (hasEstimates) status = "estimated";
	else if (!hasPrecise && !hasEstimates) status = "incomplete"; // Safe fallback for empty lists

	return {
		totalMass: parseFloat(totalMass.toFixed(2)),
		massStatus: status,
		missingMassIngredients: missing,
	};
}

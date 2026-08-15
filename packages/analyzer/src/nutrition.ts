import {
	getNumericQty,
	WarningCode,
	pushWarning,
	type Warning,
} from "@gram-lang/kitchen";
import { getIngredientData } from "./ingredient_db";
import { standardizeMass } from "./mass_standardization";
import { NUTRIENTS, type Macros, type NutrientKey } from "./schemas";
import { resolveContributingUsage } from "./usage_selection";
import type {
	NutritionMetrics,
	IngredientData,
	AnalyzedUsage,
	MassMetrics,
} from "./types";

/**
 * Running sums, before rounding. Every nutrient is optional here — a key stays
 * absent until some ingredient actually contributes it, so "no ingredient had
 * this data" stays distinguishable from "this recipe genuinely has none". The
 * four required nutrients are seeded to 0 up front, which is what makes the
 * cast to `Macros` in `deriveBase()` honest.
 */
type Totals = Partial<Record<NutrientKey, number>>;

export type NutritionItem = AnalyzedUsage & {
	usage?: NutritionItem[];
};

function emptyTotals(): Totals {
	const totals: Totals = {};
	for (const n of NUTRIENTS) {
		if (n.required) totals[n.key] = 0;
	}
	return totals;
}

/**
 * Divides the unrounded running sums by `divisor` and rounds each nutrient to
 * its own precision.
 *
 * Dividing here rather than at the call site is deliberate: the previous
 * per-portion values were derived from the *already rounded* total, so an
 * 8-portion recipe compounded the rounding error eight times over. Every basis
 * (whole recipe, per portion, per 100 g) now comes off the same raw sums.
 */
function deriveBase(totals: Totals, divisor: number): Macros {
	const out: Totals = {};
	for (const n of NUTRIENTS) {
		const value = totals[n.key];
		if (value === undefined) continue;
		const factor = 10 ** n.dp;
		out[n.key] = Math.round((value / divisor) * factor) / factor;
	}
	return out as Macros;
}

export function calculateNutrition(
	ingredients: NutritionItem[],
	database: Record<string, IngredientData>,
	portions?: number,
	massStatus?: MassMetrics["massStatus"],
): NutritionMetrics {
	const totals = emptyTotals();

	let metricsCount = 0;
	let knownCount = 0;
	let anyEstimate = false;
	// Mass of the ingredients that actually contributed macros. This, not
	// `metrics.totalMass`, is the per-100 g denominator: it comes off the same
	// list, in the same loop, at the same moment as the numerator, so the two
	// can't disagree about composites, optional items or resolution order.
	let accountedMass = 0;
	const warnings: Warning[] = [];

	// Flatten composite ingredients and alternatives
	const flatList: NutritionItem[] = [];

	ingredients.forEach((item) => {
		if (item.type === "composite" && item.usage) {
			// A composite parent marked optional takes its children with it.
			if (item.modifiers?.includes("optional")) return;
			flatList.push(...item.usage);
			return;
		}
		// Optional ingredients (`?`) are excluded from the conservative
		// baseline; an alternative group contributes only its first (preferred)
		// option. Both rules live in resolveContributingUsage() so the mass
		// metrics apply exactly the same ones — the two totals disagreeing on
		// what's "in" the recipe is what makes a kcal/100 g figure meaningless.
		const contributing = resolveContributingUsage(item);
		if (contributing) flatList.push(contributing as NutritionItem);
	});

	flatList.forEach((rawItem) => {
		// A composite child or alternative option can carry its own `optional`
		// modifier even when the parent/group wasn't marked optional as a whole.
		const item = resolveContributingUsage(rawItem) as NutritionItem | null;
		if (!item) return;

		const id = item.id;
		if (!id) return;

		// Ingredients declared without a quantity (@salt{}, @oil) have negligible/trace mass.
		// They are intentional "to taste" entries — skip silently, no warning, no coverage hit.
		if (item.qty == null && !item.normalizedMass) return;

		metricsCount++;

		let mass = 0;
		let isEst = false;

		// Try to obtain mass (reuse normalizedMass if available)
		if (item.normalizedMass) {
			mass = item.normalizedMass;
			if (item.isEstimate) isEst = true;
		} else if (item.qty) {
			const val = getNumericQty(item.qty);
			if (val !== null) {
				const unit = item.unit || "unit";

				// item.name may be undefined for composite children (usage items only carry id+qty)
				const norm = standardizeMass(val, unit, database, item.name || item.id);
				if (norm) {
					mass = norm.mass;
					isEst = norm.isEstimate;
				}
			}
		}

		if (isEst) anyEstimate = true;

		if (mass > 0) {
			const data = getIngredientData(id, database);
			if (!data) {
				pushWarning(warnings, WarningCode.MISSING_INGREDIENT, { id });
			} else if (data.nutrition) {
				knownCount++;
				accountedMass += mass;
				// Database values are per 100 g of the raw ingredient.
				const factor = mass / 100.0;

				const m = data.nutrition;
				for (const n of NUTRIENTS) {
					const value = m[n.key];
					if (value === undefined) continue;
					totals[n.key] = (totals[n.key] ?? 0) + value * factor;
				}
			} else {
				pushWarning(warnings, WarningCode.MISSING_MACROS, { id });
			}
		} else {
			pushWarning(warnings, WarningCode.UNKNOWN_MASS, { id });
		}
	});

	const coverage = metricsCount > 0 ? knownCount / metricsCount : 0;

	const res: NutritionMetrics = {
		total: deriveBase(totals, 1),
		isEstimate: anyEstimate,
		coverage,
		warnings: warnings.length > 0 ? warnings : undefined,
	};

	// Emitted whenever `portions` is known, including 1 — the documented
	// contract is "per portion if portions is set", and forcing every consumer
	// to fall back to `perPortion || total` is how the three renderer backends
	// ended up disagreeing about which basis they were showing.
	if (portions !== undefined && Number.isFinite(portions) && portions > 0) {
		res.portions = portions;
		res.perPortion = deriveBase(totals, portions);
	}

	// Independent of `portions`, so a recipe that never declared one still gets
	// a standardized basis instead of nothing.
	if (accountedMass > 0) {
		res.per100g = deriveBase(totals, accountedMass / 100);
		res.basis = { mass: Math.round(accountedMass * 100) / 100, massStatus };
	}

	return res;
}

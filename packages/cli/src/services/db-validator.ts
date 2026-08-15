import type { IngredientData } from "@gram-lang/analyzer";
import { isCategoryKey, type CategoryKey } from "@gram-lang/i18n";
import type { DbIssue, DbValidateResult } from "../types";

// These bounds used to exist only here, as an a-posteriori report on data
// already written to disk. `db-enricher.ts` now imports them to constrain
// the AI response schema
// itself, so an implausible value (a prompt-injected density of `1e9`) is
// rejected before it's ever written — one source of truth for "a plausible
// ingredient value", not two that can drift apart.
export const MAX_DENSITY = 2.5;
export const MIN_DENSITY = 0.05;
export const MAX_CALORIES = 900;
export const MIN_UNIT_WEIGHT = 0.01;
export const MAX_UNIT_WEIGHT = 10000;

// Atwater energy-from-macros formula (4 kcal/g protein, 4 kcal/g carbs,
// 9 kcal/g fat, 7 kcal/g alcohol) used as a coherence check, not a source of
// truth: it catches a calorie count that's wildly inconsistent with the
// stated macros (a plausible AI hallucination), never a claim about the
// "correct" calorie value for any specific product. Tolerance is
// intentionally generous — real entries routinely diverge from the textbook
// formula (fiber/sugar-alcohol accounting, rounding, lab-measured values).
export const ATWATER_RELATIVE_TOLERANCE = 0.2;
export const ATWATER_ABSOLUTE_FLOOR = 50;

// Sub-macros shouldn't exceed their parent macro, but independently
// rounded/partially-reported values routinely sum slightly over — a soft
// tolerance, not a strict inequality.
export const SUBMACRO_RELATIVE_TOLERANCE = 0.1;
export const SUBMACRO_ABSOLUTE_FLOOR = 1;

// Broad, food-science-*category*-level sanity ranges for density — an
// order-of-magnitude check to catch AI hallucination (a "density" of 5 for
// an oil), never an assertion about one specific product's exact density
// (see docs/explanation/philosophy.mdx's Data Philosophy section for why
// that distinction matters). Categories too heterogeneous for a useful tight
// range (dairy spans milk to hard cheese; sugars spans granulated sugar to
// honey; condiments/herbs/nuts/beverages/other are all over the map) are
// deliberately left out and fall back to the global MIN_DENSITY/MAX_DENSITY
// ceiling below. Placeholder values — a starting point, not a certified
// reference; adjust freely.
export const DENSITY_RANGES: Partial<
	Record<CategoryKey, { min: number; max: number }>
> = {
	oils: { min: 0.85, max: 1.0 },
	grains: { min: 0.3, max: 1.0 },
	legumes: { min: 0.5, max: 1.0 },
	spices: { min: 0.2, max: 0.9 },
	meat: { min: 0.9, max: 1.15 },
	seafood: { min: 0.9, max: 1.15 },
	fruits: { min: 0.7, max: 1.1 },
	vegetables: { min: 0.7, max: 1.15 },
};

export function validateDb(
	db: Record<string, IngredientData>,
	dbPath: string,
): DbValidateResult {
	const issues: DbIssue[] = [];

	// 1. Duplicate aliases across different ingredients
	const aliasMap = new Map<string, string>();
	for (const [id, data] of Object.entries(db)) {
		for (const alias of data.aliases ?? []) {
			const normalized = alias.toLowerCase().trim();
			if (aliasMap.has(normalized)) {
				issues.push({
					level: "error",
					category: "Coherence",
					ingredient: id,
					message: `"${alias}" is also an alias for "${aliasMap.get(normalized)}"`,
				});
			} else {
				aliasMap.set(normalized, id);
			}
		}
	}

	// 2. Missing density and nutrition
	for (const [id, data] of Object.entries(db)) {
		if (!data.physical?.density) {
			issues.push({
				level: "warning",
				category: "Completeness",
				ingredient: id,
				message: "Missing density — volume→mass conversion will fail",
			});
		}
		if (!data.nutrition) {
			issues.push({
				level: "warning",
				category: "Completeness",
				ingredient: id,
				message: "No nutrition data",
			});
		}
	}

	// 3. Aberrant / internally-incoherent values — no external reference,
	// everything here is either a physical-plausibility bound or a
	// cross-field arithmetic check against the ingredient's own other fields.
	for (const [id, data] of Object.entries(db)) {
		const { physical, nutrition, category } = data;

		if (nutrition) {
			const {
				calories,
				protein,
				carbs,
				fat,
				sugar,
				sat_fat,
				mono_fat,
				poly_fat,
				alcohol,
			} = nutrition;

			for (const field of ["fat", "protein", "carbs"] as const) {
				const val = nutrition[field];
				if (val !== undefined && val < 0) {
					issues.push({
						level: "error",
						category: "Coherence",
						ingredient: id,
						message: `Negative value for "${field}" (${val})`,
					});
				}
			}

			if (calories !== undefined && calories > MAX_CALORIES) {
				issues.push({
					level: "warning",
					category: "Coherence",
					ingredient: id,
					message: `Unusually high calorie density (${calories} kcal/100g) — verify`,
				});
			}

			if (calories !== undefined) {
				const expected =
					4 * (protein ?? 0) +
					4 * (carbs ?? 0) +
					9 * (fat ?? 0) +
					7 * (alcohol ?? 0);
				const tolerance = Math.max(
					ATWATER_ABSOLUTE_FLOOR,
					ATWATER_RELATIVE_TOLERANCE * expected,
				);
				if (expected > 0 && Math.abs(calories - expected) > tolerance) {
					issues.push({
						level: "warning",
						category: "Coherence",
						ingredient: id,
						message: `Calories (${calories} kcal/100g) diverge from the macro-based estimate (~${Math.round(expected)} kcal via 4×protein+4×carbs+9×fat+7×alcohol) — verify`,
					});
				}
			}

			if (sugar !== undefined && carbs !== undefined) {
				const tolerance = Math.max(
					SUBMACRO_ABSOLUTE_FLOOR,
					SUBMACRO_RELATIVE_TOLERANCE * carbs,
				);
				if (sugar > carbs + tolerance) {
					issues.push({
						level: "warning",
						category: "Coherence",
						ingredient: id,
						message: `Sugar (${sugar}g) exceeds carbs (${carbs}g) — verify`,
					});
				}
			}

			const fatSubtypes = (sat_fat ?? 0) + (mono_fat ?? 0) + (poly_fat ?? 0);
			if (fatSubtypes > 0 && fat !== undefined) {
				const tolerance = Math.max(
					SUBMACRO_ABSOLUTE_FLOOR,
					SUBMACRO_RELATIVE_TOLERANCE * fat,
				);
				if (fatSubtypes > fat + tolerance) {
					issues.push({
						level: "warning",
						category: "Coherence",
						ingredient: id,
						message: `Fat sub-types (sat+mono+poly = ${fatSubtypes}g) exceed total fat (${fat}g) — verify`,
					});
				}
			}
		}

		if (physical) {
			const { density, unit_weight } = physical;

			if (density !== undefined) {
				if (density > MAX_DENSITY) {
					issues.push({
						level: "warning",
						category: "Coherence",
						ingredient: id,
						message: `Unusually high density (${density} g/mL) — verify`,
					});
				} else if (density < MIN_DENSITY) {
					issues.push({
						level: "warning",
						category: "Coherence",
						ingredient: id,
						message: `Unusually low density (${density} g/mL) — verify`,
					});
				} else if (category && isCategoryKey(category)) {
					const range = DENSITY_RANGES[category];
					if (range && (density < range.min || density > range.max)) {
						issues.push({
							level: "warning",
							category: "Coherence",
							ingredient: id,
							message: `Density (${density} g/mL) is outside the typical range for "${category}" (${range.min}–${range.max} g/mL) — verify`,
						});
					}
				}
			}

			if (
				unit_weight !== undefined &&
				(unit_weight < MIN_UNIT_WEIGHT || unit_weight > MAX_UNIT_WEIGHT)
			) {
				issues.push({
					level: "warning",
					category: "Coherence",
					ingredient: id,
					message: `Unusual unit weight (${unit_weight} g) — verify`,
				});
			}
		}
	}

	return {
		dbPath,
		ingredientCount: Object.keys(db).length,
		issues,
		hasErrors: issues.some((i) => i.level === "error"),
	};
}

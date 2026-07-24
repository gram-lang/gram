import type { IngredientData } from "@gram-lang/analyzer";
import type { DbIssue, DbValidateResult } from "../types";

// Audit 2026-07-22, cli finding I-26, Phase 18: these bounds used to exist
// only here, as an a-posteriori report on data already written to disk.
// `db-enricher.ts` now imports them to constrain the AI response schema
// itself, so an implausible value (a prompt-injected density of `1e9`) is
// rejected before it's ever written — one source of truth for "a plausible
// ingredient value", not two that can drift apart.
export const MAX_DENSITY = 2.5;
export const MAX_CALORIES = 900;

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

	// 3. Aberrant values
	for (const [id, data] of Object.entries(db)) {
		const cal = data.nutrition?.calories;
		if (cal !== undefined && cal > MAX_CALORIES) {
			issues.push({
				level: "warning",
				category: "Coherence",
				ingredient: id,
				message: `Unusually high calorie density (${cal} kcal/100g) — verify`,
			});
		}
		const density = data.physical?.density;
		if (density !== undefined && density > MAX_DENSITY) {
			issues.push({
				level: "warning",
				category: "Coherence",
				ingredient: id,
				message: `Unusually high density (${density} g/ml) — verify`,
			});
		}
		if (data.nutrition) {
			for (const field of ["fat", "protein", "carbs"] as const) {
				const val = data.nutrition[field];
				if (val !== undefined && val < 0) {
					issues.push({
						level: "error",
						category: "Coherence",
						ingredient: id,
						message: `Negative value for "${field}" (${val})`,
					});
				}
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

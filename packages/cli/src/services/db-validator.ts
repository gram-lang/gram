import type { IngredientData } from "@gram-lang/analyzer";
import type { DbIssue, DbValidateResult } from "../types";

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
		if (cal !== undefined && cal > 900) {
			issues.push({
				level: "warning",
				category: "Coherence",
				ingredient: id,
				message: `Unusually high calorie density (${cal} kcal/100g) — verify`,
			});
		}
		const density = data.physical?.density;
		if (density !== undefined && density > 2.5) {
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

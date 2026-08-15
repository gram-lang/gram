import type { z } from "zod";
import type {
	AnalyzerOptionsSchema,
	IngredientDataSchema,
	Macros,
} from "./schemas";

export type AnalyzerOptions = z.infer<typeof AnalyzerOptionsSchema>;

import type {
	Usage,
	ProcessedSection,
	CompilationResult,
	Warning,
	ShoppingListItem,
	CompositeItem,
} from "@gram-lang/kitchen";

export interface MassMetrics {
	totalMass: number;
	massStatus: "precise" | "estimated" | "incomplete";
	missingMassIngredients: string[];
}

export interface NutritionMetrics {
	/** The whole recipe, at the quantities it was compiled/scaled to. */
	total: Macros;
	/** Present whenever the portion count is known — see NutritionMetrics.portions. */
	perPortion?: Macros;
	/**
	 * Per 100 g of the ingredients that contributed macros (see `basis`).
	 * Independent of `portions`, so an unportioned recipe still gets a
	 * standardized basis.
	 *
	 * Gram models no cooking loss — no evaporation, no bake loss — so this is
	 * per 100 g of the *raw assembled* mixture, which understates a reduced
	 * stew or a baked loaf against a finished-product label.
	 */
	per100g?: Macros;
	/** The divisor `perPortion` was derived with, once resolved. */
	portions?: number;
	/**
	 * The denominator behind `per100g`, exposed so a UI can caveat the figure
	 * without recomputing it: `massStatus: "incomplete"` means the mass is a
	 * lower bound, and the density therefore an over-estimate.
	 */
	basis?: {
		mass: number;
		massStatus?: MassMetrics["massStatus"];
	};
	isEstimate: boolean;
	coverage: number;
	warnings?: Warning[];
}

export type IngredientData = z.infer<typeof IngredientDataSchema>;

export interface AnalyzedUsage extends Usage {
	normalizedMass?: number;
	conversionMethod?:
		| "physical"
		| "density"
		| "unit_weight"
		| "default"
		| "explicit"
		| "estimate"
		| "relative";
	isEstimate?: boolean;
	purchasingMass?: number;
	bakersPercentage?: number;
}

export interface AnalyzedSection extends ProcessedSection {
	ingredients: AnalyzedUsage[];
	cookware: AnalyzedUsage[];
	metrics?: MassMetrics;
}

export interface AnalyzedCompilationResult
	extends Omit<CompilationResult, "sections" | "metrics"> {
	sections: AnalyzedSection[];
	shopping_list: (AnalyzedUsage | ShoppingListItem | CompositeItem)[];
	metrics: CompilationResult["metrics"] &
		MassMetrics & {
			nutrition?: NutritionMetrics;
		};
}

export interface AnalysisResult {
	result: AnalyzedCompilationResult;
	missingIngredients: string[];
}

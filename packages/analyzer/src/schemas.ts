import { z } from "zod";

export const AnalyzerOptionsSchema = z.object({
	enableMassStandardization: z.boolean().optional(),
	enableYieldCalculation: z.boolean().optional(),
	enableNutritionalEstimation: z.boolean().optional(),
	enableBakersMath: z.boolean().optional(),
	bakersReference: z.string().optional(),
	portions: z.number().positive().optional(),
});

export const IngredientDataSchema = z.object({
	name: z.string(),
	physical: z
		.object({
			// Audit 2026-07-22, analyzer finding B1: `density` was required
			// whenever `physical` was present at all, which rejected any
			// entry described only by `unit_weight` (count -> mass, e.g. "1
			// avocado") — including the analyzer's own README example and
			// test fixtures. An ingredient can legitimately have either,
			// both, or neither.
			density: z.number().positive().optional(),
			yield: z.number().gt(0).max(1).optional(),
			unit_weight: z.number().positive().optional(),
		})
		.optional(),
	nutrition: z
		.object({
			calories: z.number().min(0),
			protein: z.number().min(0),
			carbs: z.number().min(0),
			fat: z.number().min(0),
			sugar: z.number().min(0).optional(),
			sat_fat: z.number().min(0).optional(),
			mono_fat: z.number().min(0).optional(),
			poly_fat: z.number().min(0).optional(),
			fiber: z.number().min(0).optional(),
			sodium: z.number().min(0).optional(),
			alcohol: z.number().min(0).optional(),
		})
		.optional(),
	aliases: z.array(z.string()).optional(),
	tags: z.array(z.string()).optional(),
	category: z.string().optional(),
});

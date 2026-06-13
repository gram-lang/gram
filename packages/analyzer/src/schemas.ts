import { z } from 'zod';

export const AnalyzerOptionsSchema = z.object({
    enableMassNormalization: z.boolean().optional(),
    enableYieldManagement: z.boolean().optional(),
    enableNutritionalEstimation: z.boolean().optional(),
    portions: z.number().positive().optional(),
});

export const IngredientDataSchema = z.object({
    name: z.string(),
    physical: z.object({
        density: z.number().positive(),
        yield: z.number().min(0).max(1),
        unit_weight: z.number().positive().optional(),
    }).optional(),
    states: z.record(
        z.string(),
        z.object({
            macros: z.object({
                kcal: z.number().min(0),
                protein: z.number().min(0),
                carbs: z.number().min(0),
                fat: z.number().min(0),
                sugar: z.number().min(0).optional(),
                fiber: z.number().min(0).optional(),
                sodium: z.number().min(0).optional(),
            }).optional()
        })
    ),
    aliases: z.array(z.string()),
});

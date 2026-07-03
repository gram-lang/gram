import { z } from 'zod';

export const AnalyzerOptionsSchema = z.object({
    enableMassStandardization: z.boolean().optional(),
    enableYieldCalculation: z.boolean().optional(),
    enableNutritionalEstimation: z.boolean().optional(),
    portions: z.number().positive().optional(),
});

export const IngredientDataSchema = z.object({
    name: z.string(),
    physical: z.object({
        density: z.number().positive(),
        yield: z.number().min(0).max(1).optional(),
        unit_weight: z.number().positive().optional(),
    }).optional(),
    nutrition: z.object({
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
    }).optional(),
    aliases: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    category: z.string().optional(),
});

import { z } from 'zod';

export const MacrosSchema = z.object({
  calories: z.number().default(0),
  protein: z.number().default(0),
  carbs: z.number().default(0),
  fat: z.number().default(0),
  sugar: z.number().optional(),
  fiber: z.number().optional(),
  salt: z.number().optional(),
});

export const IngredientSchema = z.object({
  density: z.number().default(1.0),
  unit_weight: z.number().optional(),
  yield: z.number().default(1.0),
  aliases: z.array(z.string()).default([]),
  macros: MacrosSchema.optional(),
});

export const IngredientDbSchema = z.record(z.string(), IngredientSchema);

export type Macros = z.infer<typeof MacrosSchema>;
export type Ingredient = z.infer<typeof IngredientSchema>;
export type IngredientDb = z.infer<typeof IngredientDbSchema>;

import { z } from 'zod';

export const MacrosSchema = z.object({
  kcal: z.number().default(0), // Changed from calories to kcal to match YAML
  protein: z.number().default(0),
  carbs: z.number().default(0),
  fat: z.number().default(0),
  sugar: z.number().optional(),
  fiber: z.number().optional(),
  sodium: z.number().optional(), // Changed from salt to sodium to match YAML
  water: z.number().optional(),
  sat_fat: z.number().optional(),
  mono_fat: z.number().optional(),
  poly_fat: z.number().optional(),
  alcohol: z.number().optional(),
});

export const PhysicalSchema = z.object({
  density: z.number().default(1.0),
  yield: z.number().default(1.0),
  unit_weight: z.number().optional(),
});

export const IngredientStateSchema = z.object({
  macros: MacrosSchema.optional(),
});

export const IngredientSchema = z.object({
  name: z.string(),
  physical: PhysicalSchema.optional(),
  states: z.record(z.string(), IngredientStateSchema).default({}),
  aliases: z.array(z.string()).default([]),
  i18n: z.record(z.string(), z.string().or(z.array(z.string()))).optional(), // Allow string or array for i18n
  tags: z.array(z.string()).default([]),
  meta: z.object({ code_ciqual: z.string().optional() }).optional(),
});

export const IngredientDbSchema = z.record(z.string(), IngredientSchema);

export type Macros = z.infer<typeof MacrosSchema>;
export type Ingredient = z.infer<typeof IngredientSchema>;
export type IngredientDb = z.infer<typeof IngredientDbSchema>;

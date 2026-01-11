import { z } from 'zod';
export declare const MacrosSchema: z.ZodObject<{
    calories: z.ZodDefault<z.ZodNumber>;
    protein: z.ZodDefault<z.ZodNumber>;
    carbs: z.ZodDefault<z.ZodNumber>;
    fat: z.ZodDefault<z.ZodNumber>;
    sugar: z.ZodOptional<z.ZodNumber>;
    fiber: z.ZodOptional<z.ZodNumber>;
    salt: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const IngredientSchema: z.ZodObject<{
    density: z.ZodDefault<z.ZodNumber>;
    unit_weight: z.ZodOptional<z.ZodNumber>;
    yield: z.ZodDefault<z.ZodNumber>;
    aliases: z.ZodDefault<z.ZodArray<z.ZodString>>;
    i18n: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>>;
    macros: z.ZodOptional<z.ZodObject<{
        calories: z.ZodDefault<z.ZodNumber>;
        protein: z.ZodDefault<z.ZodNumber>;
        carbs: z.ZodDefault<z.ZodNumber>;
        fat: z.ZodDefault<z.ZodNumber>;
        sugar: z.ZodOptional<z.ZodNumber>;
        fiber: z.ZodOptional<z.ZodNumber>;
        salt: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const IngredientDbSchema: z.ZodRecord<z.ZodString, z.ZodObject<{
    density: z.ZodDefault<z.ZodNumber>;
    unit_weight: z.ZodOptional<z.ZodNumber>;
    yield: z.ZodDefault<z.ZodNumber>;
    aliases: z.ZodDefault<z.ZodArray<z.ZodString>>;
    i18n: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>>;
    macros: z.ZodOptional<z.ZodObject<{
        calories: z.ZodDefault<z.ZodNumber>;
        protein: z.ZodDefault<z.ZodNumber>;
        carbs: z.ZodDefault<z.ZodNumber>;
        fat: z.ZodDefault<z.ZodNumber>;
        sugar: z.ZodOptional<z.ZodNumber>;
        fiber: z.ZodOptional<z.ZodNumber>;
        salt: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>>;
export type Macros = z.infer<typeof MacrosSchema>;
export type Ingredient = z.infer<typeof IngredientSchema>;
export type IngredientDb = z.infer<typeof IngredientDbSchema>;

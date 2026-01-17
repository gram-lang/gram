import { z } from 'zod';
export declare const MacrosSchema: z.ZodObject<{
    kcal: z.ZodDefault<z.ZodNumber>;
    protein: z.ZodDefault<z.ZodNumber>;
    carbs: z.ZodDefault<z.ZodNumber>;
    fat: z.ZodDefault<z.ZodNumber>;
    sugar: z.ZodOptional<z.ZodNumber>;
    fiber: z.ZodOptional<z.ZodNumber>;
    sodium: z.ZodOptional<z.ZodNumber>;
    water: z.ZodOptional<z.ZodNumber>;
    sat_fat: z.ZodOptional<z.ZodNumber>;
    mono_fat: z.ZodOptional<z.ZodNumber>;
    poly_fat: z.ZodOptional<z.ZodNumber>;
    alcohol: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const PhysicalSchema: z.ZodObject<{
    density: z.ZodDefault<z.ZodNumber>;
    yield: z.ZodDefault<z.ZodNumber>;
    unit_weight: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const IngredientStateSchema: z.ZodObject<{
    macros: z.ZodOptional<z.ZodObject<{
        kcal: z.ZodDefault<z.ZodNumber>;
        protein: z.ZodDefault<z.ZodNumber>;
        carbs: z.ZodDefault<z.ZodNumber>;
        fat: z.ZodDefault<z.ZodNumber>;
        sugar: z.ZodOptional<z.ZodNumber>;
        fiber: z.ZodOptional<z.ZodNumber>;
        sodium: z.ZodOptional<z.ZodNumber>;
        water: z.ZodOptional<z.ZodNumber>;
        sat_fat: z.ZodOptional<z.ZodNumber>;
        mono_fat: z.ZodOptional<z.ZodNumber>;
        poly_fat: z.ZodOptional<z.ZodNumber>;
        alcohol: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const IngredientSchema: z.ZodObject<{
    name: z.ZodString;
    physical: z.ZodOptional<z.ZodObject<{
        density: z.ZodDefault<z.ZodNumber>;
        yield: z.ZodDefault<z.ZodNumber>;
        unit_weight: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    states: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
        macros: z.ZodOptional<z.ZodObject<{
            kcal: z.ZodDefault<z.ZodNumber>;
            protein: z.ZodDefault<z.ZodNumber>;
            carbs: z.ZodDefault<z.ZodNumber>;
            fat: z.ZodDefault<z.ZodNumber>;
            sugar: z.ZodOptional<z.ZodNumber>;
            fiber: z.ZodOptional<z.ZodNumber>;
            sodium: z.ZodOptional<z.ZodNumber>;
            water: z.ZodOptional<z.ZodNumber>;
            sat_fat: z.ZodOptional<z.ZodNumber>;
            mono_fat: z.ZodOptional<z.ZodNumber>;
            poly_fat: z.ZodOptional<z.ZodNumber>;
            alcohol: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>>;
    aliases: z.ZodDefault<z.ZodArray<z.ZodString>>;
    i18n: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString>]>>>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
    meta: z.ZodOptional<z.ZodObject<{
        code_ciqual: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const IngredientDbSchema: z.ZodRecord<z.ZodString, z.ZodObject<{
    name: z.ZodString;
    physical: z.ZodOptional<z.ZodObject<{
        density: z.ZodDefault<z.ZodNumber>;
        yield: z.ZodDefault<z.ZodNumber>;
        unit_weight: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    states: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
        macros: z.ZodOptional<z.ZodObject<{
            kcal: z.ZodDefault<z.ZodNumber>;
            protein: z.ZodDefault<z.ZodNumber>;
            carbs: z.ZodDefault<z.ZodNumber>;
            fat: z.ZodDefault<z.ZodNumber>;
            sugar: z.ZodOptional<z.ZodNumber>;
            fiber: z.ZodOptional<z.ZodNumber>;
            sodium: z.ZodOptional<z.ZodNumber>;
            water: z.ZodOptional<z.ZodNumber>;
            sat_fat: z.ZodOptional<z.ZodNumber>;
            mono_fat: z.ZodOptional<z.ZodNumber>;
            poly_fat: z.ZodOptional<z.ZodNumber>;
            alcohol: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>>;
    aliases: z.ZodDefault<z.ZodArray<z.ZodString>>;
    i18n: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString>]>>>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
    meta: z.ZodOptional<z.ZodObject<{
        code_ciqual: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>>;
export type Macros = z.infer<typeof MacrosSchema>;
export type Ingredient = z.infer<typeof IngredientSchema>;
export type IngredientDb = z.infer<typeof IngredientDbSchema>;

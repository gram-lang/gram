"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngredientDbSchema = exports.IngredientSchema = exports.IngredientStateSchema = exports.PhysicalSchema = exports.MacrosSchema = void 0;
const zod_1 = require("zod");
exports.MacrosSchema = zod_1.z.object({
    kcal: zod_1.z.number().default(0), // Changed from calories to kcal to match YAML
    protein: zod_1.z.number().default(0),
    carbs: zod_1.z.number().default(0),
    fat: zod_1.z.number().default(0),
    sugar: zod_1.z.number().optional(),
    fiber: zod_1.z.number().optional(),
    sodium: zod_1.z.number().optional(), // Changed from salt to sodium to match YAML
    water: zod_1.z.number().optional(),
    sat_fat: zod_1.z.number().optional(),
    mono_fat: zod_1.z.number().optional(),
    poly_fat: zod_1.z.number().optional(),
    alcohol: zod_1.z.number().optional(),
});
exports.PhysicalSchema = zod_1.z.object({
    density: zod_1.z.number().default(1.0),
    yield: zod_1.z.number().default(1.0),
    unit_weight: zod_1.z.number().optional(),
});
exports.IngredientStateSchema = zod_1.z.object({
    macros: exports.MacrosSchema.optional(),
});
exports.IngredientSchema = zod_1.z.object({
    name: zod_1.z.string(),
    physical: exports.PhysicalSchema.optional(),
    states: zod_1.z.record(zod_1.z.string(), exports.IngredientStateSchema).default({}),
    aliases: zod_1.z.array(zod_1.z.string()).default([]),
    i18n: zod_1.z.record(zod_1.z.string(), zod_1.z.string().or(zod_1.z.array(zod_1.z.string()))).optional(), // Allow string or array for i18n
    tags: zod_1.z.array(zod_1.z.string()).default([]),
    meta: zod_1.z.object({ code_ciqual: zod_1.z.string().optional() }).optional(),
});
exports.IngredientDbSchema = zod_1.z.record(zod_1.z.string(), exports.IngredientSchema);

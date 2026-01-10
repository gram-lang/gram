"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngredientDbSchema = exports.IngredientSchema = exports.MacrosSchema = void 0;
const zod_1 = require("zod");
exports.MacrosSchema = zod_1.z.object({
    calories: zod_1.z.number().default(0),
    protein: zod_1.z.number().default(0),
    carbs: zod_1.z.number().default(0),
    fat: zod_1.z.number().default(0),
    sugar: zod_1.z.number().optional(),
    fiber: zod_1.z.number().optional(),
    salt: zod_1.z.number().optional(),
});
exports.IngredientSchema = zod_1.z.object({
    density: zod_1.z.number().default(1.0),
    unit_weight: zod_1.z.number().optional(),
    yield: zod_1.z.number().default(1.0),
    aliases: zod_1.z.array(zod_1.z.string()).default([]),
    macros: exports.MacrosSchema.optional(),
});
exports.IngredientDbSchema = zod_1.z.record(zod_1.z.string(), exports.IngredientSchema);

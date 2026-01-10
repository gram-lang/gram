"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadIngredientDb = loadIngredientDb;
exports.buildFastLookupMap = buildFastLookupMap;
const schema_1 = require("./schema");
const ingredients_yaml_1 = __importDefault(require("../../../../data/ingredients.yaml"));
function loadIngredientDb(userDbOverride) {
    const ingredientsMap = {};
    // 1. Process Core DB
    try {
        const result = schema_1.IngredientDbSchema.safeParse(ingredients_yaml_1.default);
        if (!result.success) {
            console.error(`Invalid Core Ingredient DB:`, result.error.format());
            // In a crash situation, we might want to throw, but let's try to proceed or just throw
            throw new Error(`Core DB validation failed`);
        }
        Object.assign(ingredientsMap, result.data);
    }
    catch (e) {
        console.error('Failed to load Core DB:', e);
        // If core fails, we are in trouble.
        throw e;
    }
    // 2. Process User DB (Override)
    if (userDbOverride) {
        try {
            const result = schema_1.IngredientDbSchema.safeParse(userDbOverride);
            if (!result.success) {
                console.error(`Invalid User Ingredient DB:`, result.error.format());
                // Depending on policy, we might ignore invalid user db or throw. 
                // Let's log and ignore only the invalid parts? No, safeParse fails entirely for the Record map if one entry is wrong?
                // Actually Zod Record validates all values. If one is wrong, strict mode?
                // Let's just log error and allow clean partial merge if possible? 
                // For now, simple block override if invalid.
            }
            else {
                Object.assign(ingredientsMap, result.data);
            }
        }
        catch (e) {
            console.error('Failed to apply User DB override:', e);
        }
    }
    return ingredientsMap;
}
function buildFastLookupMap(db) {
    const lookup = {};
    for (const [canonicalName, data] of Object.entries(db)) {
        // Add canonical name
        lookup[canonicalName] = data;
        // Add aliases
        if (data.aliases) {
            for (const alias of data.aliases) {
                lookup[alias] = data;
            }
        }
    }
    return lookup;
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadIngredientDb = loadIngredientDb;
exports.buildFastLookupMap = buildFastLookupMap;
const schema_1 = require("./schema");
function loadIngredientDb(sources = []) {
    const ingredientsMap = {};
    // 1. Process File-based DBs
    for (const source of sources) {
        if (!source.data)
            continue; // Skip empty files
        try {
            const result = schema_1.IngredientDbSchema.safeParse(source.data);
            if (!result.success) {
                console.error(`Invalid Ingredient DB [${source.name}]:`, result.error.format());
                continue;
            }
            Object.assign(ingredientsMap, result.data);
        }
        catch (e) {
            console.error(`Failed to load partial DB [${source.name}]:`, e);
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
        // Add i18n aliases
        if (data.i18n) {
            for (const val of Object.values(data.i18n)) {
                if (Array.isArray(val)) {
                    for (const alias of val) {
                        lookup[alias] = data;
                    }
                }
                else if (typeof val === 'string') {
                    lookup[val] = data;
                }
            }
        }
    }
    return lookup;
}

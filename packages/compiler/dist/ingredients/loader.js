"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadIngredientDb = loadIngredientDb;
exports.buildFastLookupMap = buildFastLookupMap;
const schema_1 = require("./schema");
// Import all data sources
const beverages_yaml_1 = __importDefault(require("../../../../data/beverages.yaml"));
const dairy_yaml_1 = __importDefault(require("../../../../data/dairy.yaml"));
const fats_oils_yaml_1 = __importDefault(require("../../../../data/fats-oils.yaml"));
const fruits_vegetables_nuts_yaml_1 = __importDefault(require("../../../../data/fruits-vegetables-nuts.yaml"));
const grains_cereals_yaml_1 = __importDefault(require("../../../../data/grains-cereals.yaml"));
const meats_eggs_fish_yaml_1 = __importDefault(require("../../../../data/meats-eggs-fish.yaml"));
const pantry_misc_yaml_1 = __importDefault(require("../../../../data/pantry-misc.yaml"));
const sugars_sweets_yaml_1 = __importDefault(require("../../../../data/sugars-sweets.yaml"));
const user_defined_yaml_1 = __importDefault(require("../../../../data/user-defined.yaml"));
function loadIngredientDb(userRuntimeOverride) {
    const ingredientsMap = {};
    // List of sources to merge, in order.
    const sources = [
        { name: 'beverages', data: beverages_yaml_1.default },
        { name: 'dairy', data: dairy_yaml_1.default },
        { name: 'fats-oils', data: fats_oils_yaml_1.default },
        { name: 'fruits-vegetables-nuts', data: fruits_vegetables_nuts_yaml_1.default },
        { name: 'grains-cereals', data: grains_cereals_yaml_1.default },
        { name: 'meats-eggs-fish', data: meats_eggs_fish_yaml_1.default },
        { name: 'pantry-misc', data: pantry_misc_yaml_1.default },
        { name: 'sugars-sweets', data: sugars_sweets_yaml_1.default },
        { name: 'user-defined', data: user_defined_yaml_1.default }, // Local user overrides (file-based)
    ];
    // 1. Process File-based DBs
    for (const source of sources) {
        if (!source.data)
            continue; // Skip empty files
        try {
            const result = schema_1.IngredientDbSchema.safeParse(source.data);
            if (!result.success) {
                console.error(`Invalid Ingredient DB [${source.name}]:`, result.error.format());
                // We log but continue, allowing other partial data to load.
                // If a core file is completely busted, we might want to throw, but for now strict validation is only logged.
                continue;
            }
            Object.assign(ingredientsMap, result.data);
        }
        catch (e) {
            console.error(`Failed to load partial DB [${source.name}]:`, e);
        }
    }
    // 2. Process Runtime User DB (passed argument)
    // This allows the caller (e.g. playground component) to inject dynamic temporary overrides
    if (userRuntimeOverride) {
        try {
            const result = schema_1.IngredientDbSchema.safeParse(userRuntimeOverride);
            if (!result.success) {
                console.error(`Invalid Runtime User Ingredient DB:`, result.error.format());
            }
            else {
                Object.assign(ingredientsMap, result.data);
            }
        }
        catch (e) {
            console.error('Failed to apply Runtime User DB override:', e);
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

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIngredientData = getIngredientData;
const compiler_1 = require("@gram/compiler");
function getIngredientData(name, database) {
    const slug = (0, compiler_1.slugify)(name);
    // Direct match
    if (database[slug])
        return database[slug];
    // Simple singularization fallback (very naive)
    if (slug.endsWith('s') && database[slug.slice(0, -1)]) {
        return database[slug.slice(0, -1)];
    }
    return null;
}

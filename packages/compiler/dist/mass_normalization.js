"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeMass = normalizeMass;
const units_1 = require("./units");
const ingredient_db_1 = require("./ingredient_db");
const utils_1 = require("./utils");
function normalizeMass(amount, unit, ingredientName, overrides) {
    if (!unit) {
        // ...
    }
    const u = unit.toLowerCase().trim();
    // 1. Physical Mass
    const massMap = units_1.UNIT_CONVERSIONS.mass.map;
    if (massMap[u] !== undefined) {
        return { mass: amount * massMap[u], method: 'physical', isEstimate: false };
    }
    // 2. Volume -> Density
    const volMap = units_1.UNIT_CONVERSIONS.volume.map;
    if (volMap[u] !== undefined) {
        const volumeMl = amount * volMap[u];
        let density = 1.0; // Default Water
        let method = 'default';
        if (ingredientName) {
            // Check overrides first
            if (overrides && overrides[(0, utils_1.slugify)(ingredientName)]) {
                density = overrides[(0, utils_1.slugify)(ingredientName)];
                method = 'explicit';
            }
            else {
                const data = (0, ingredient_db_1.getIngredientData)(ingredientName);
                if (data) {
                    density = data.density;
                    method = 'density';
                }
            }
        }
        return {
            mass: volumeMl * density,
            method,
            isEstimate: method !== 'explicit'
        };
    }
    // 3. Fallback: Treat unknown units as Count/Unit units
    // e.g. "clove", "head", "stick", "slice" -> treated as "1 unit" multiplier
    if (ingredientName) {
        // Check overrides first
        if (overrides && overrides[(0, utils_1.slugify)(ingredientName)]) {
            const unitWt = overrides[(0, utils_1.slugify)(ingredientName)];
            return {
                mass: amount * unitWt,
                method: 'explicit',
                // Careful: If the override was meant for density (g/ml), this might be ambiguous?
                // But generally overrides for non-volume things imply unit weight.
                isEstimate: false
            };
        }
        const data = (0, ingredient_db_1.getIngredientData)(ingredientName);
        if (data && data.unit_weight) {
            return { mass: amount * data.unit_weight, method: 'unit_weight', isEstimate: true };
        }
    }
    return null;
}

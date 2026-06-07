"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UNIT_CONVERSIONS = void 0;
exports.normalizeMass = normalizeMass;
const compiler_1 = require("@gram/compiler");
const i18n_1 = require("./i18n");
exports.UNIT_CONVERSIONS = {
    mass: {
        base: 'g',
        map: {
            g: 1, gram: 1, grams: 1, gramme: 1, grammes: 1,
            kg: 1000, kilogram: 1000, kilograms: 1000,
            mg: 0.001, milligram: 0.001, milligrams: 0.001,
            oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
            lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592
        }
    },
    volume: {
        base: 'ml',
        map: {
            ml: 1, milliliter: 1, milliliters: 1,
            l: 1000, liter: 1000, liters: 1000, litre: 1000, litres: 1000,
            cl: 10, centiliter: 10,
            dl: 100, deciliter: 100,
            tsp: 4.9289, teaspoon: 4.9289, teaspoons: 4.9289,
            tbsp: 14.7868, tablespoon: 14.7868, tablespoons: 14.7868,
            cup: 236.588, cups: 236.588,
            pint: 473.176,
            quart: 946.353,
            gallon: 3785.41,
            'fl oz': 29.5735, 'fluid ounce': 29.5735
        }
    }
};
const ingredient_db_1 = require("./ingredient_db");
function normalizeMass(amount, unit, database, ingredientName, overrides) {
    if (!unit) {
        return null;
    }
    const u = (0, i18n_1.resolveUnit)(unit);
    // 1. Physical Mass
    const massMap = exports.UNIT_CONVERSIONS.mass.map;
    if (massMap[u] !== undefined) {
        return { mass: amount * massMap[u], method: 'physical', isEstimate: false };
    }
    // 2. Volume -> Density
    const volMap = exports.UNIT_CONVERSIONS.volume.map;
    if (volMap[u] !== undefined) {
        const volumeMl = amount * volMap[u];
        let density = 1.0; // Default Water
        let method = 'default';
        if (ingredientName) {
            // Check overrides first
            if (overrides && overrides[(0, compiler_1.slugify)(ingredientName)]) {
                density = overrides[(0, compiler_1.slugify)(ingredientName)];
                method = 'explicit';
            }
            else {
                const data = (0, ingredient_db_1.getIngredientData)(ingredientName, database);
                if (data && data.physical) {
                    density = data.physical.density;
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
        if (overrides && overrides[(0, compiler_1.slugify)(ingredientName)]) {
            const unitWt = overrides[(0, compiler_1.slugify)(ingredientName)];
            return {
                mass: amount * unitWt,
                method: 'explicit',
                // Careful: If the override was meant for density (g/ml), this might be ambiguous?
                // But generally overrides for non-volume things imply unit weight.
                isEstimate: false
            };
        }
        const data = (0, ingredient_db_1.getIngredientData)(ingredientName, database);
        if (data && data.physical && data.physical.unit_weight) {
            return { mass: amount * data.physical.unit_weight, method: 'unit_weight', isEstimate: true };
        }
    }
    return null;
}

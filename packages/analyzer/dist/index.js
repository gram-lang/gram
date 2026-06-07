"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyze = analyze;
__exportStar(require("./types"), exports);
__exportStar(require("./ingredient_db"), exports);
__exportStar(require("./mass_normalization"), exports);
__exportStar(require("./nutrition"), exports);
__exportStar(require("./metrics"), exports);
__exportStar(require("./i18n"), exports);
const metrics_1 = require("./metrics");
const nutrition_1 = require("./nutrition");
const mass_normalization_1 = require("./mass_normalization");
const ingredient_db_1 = require("./ingredient_db");
/**
 * Main entry point for recipe physical analysis.
 * Takes a pure structural CompilationResult and a macro-ingredient database,
 * then enriches it with calculated masses, yields, and nutritional profiles.
 */
function analyze(result, database, options) {
    const opts = options || {};
    const missingIngredientsSet = new Set();
    // Deep clone the compiled sections to perform safe mutations
    const sections = JSON.parse(JSON.stringify(result.sections));
    // Parse custom ingredient density overrides declared in YAML/Frontmatter metadata
    const overrides = {};
    if (result.meta && result.meta.densities) {
        const d = result.meta.densities;
        const list = Array.isArray(d) ? d : [d];
        list.forEach((entry) => {
            if (typeof entry !== 'string')
                return;
            const parts = entry.split(':');
            if (parts.length === 2) {
                const name = parts[0].trim().toLowerCase().replace(/[^a-z0-9\-]/g, '');
                const density = parseFloat(parts[1].trim());
                if (!isNaN(density)) {
                    overrides[name] = density;
                }
            }
        });
    }
    // 1. Traverse all recipe sections to calculate physical ingredient masses
    const allRawIngredients = [];
    sections.forEach(sec => {
        if (!sec.ingredients)
            sec.ingredients = [];
        sec.ingredients.forEach(item => {
            // Track ingredients missing from the database
            if (item.type !== 'reference' && item.id) {
                if (!(0, ingredient_db_1.getIngredientData)(item.id, database)) {
                    missingIngredientsSet.add(item.id);
                }
            }
            // Perform physical mass normalization if enabled
            if (opts.enableMassNormalization !== false) {
                let numericQty = null;
                if (typeof item.qty === 'number')
                    numericQty = item.qty;
                else if (item.qty && typeof item.qty === 'object' && 'value' in item.qty) {
                    numericQty = item.qty.value;
                }
                if (numericQty !== null) {
                    const norm = (0, mass_normalization_1.normalizeMass)(numericQty, item.unit || 'unit', database, item.name || item.id, overrides);
                    if (norm) {
                        item.normalizedMass = norm.mass;
                        item.conversionMethod = norm.method;
                        item.isEstimate = norm.isEstimate;
                    }
                }
            }
            if (item.type !== 'reference') {
                allRawIngredients.push(item);
            }
        });
        // Calculate mass metrics specifically for this section
        sec.metrics = (0, metrics_1.calculateMassMetrics)(sec.ingredients);
    });
    // Compute the global recipe mass totals
    const globalMassMetrics = (0, metrics_1.calculateMassMetrics)(allRawIngredients);
    // 2. Traverse and enrich the master Shopping List
    const shopping_list = result.shopping_list ? JSON.parse(JSON.stringify(result.shopping_list)) : [];
    shopping_list.forEach((item) => {
        // Resolve raw items to normalized grams
        if (opts.enableMassNormalization !== false) {
            let numericQty = null;
            if (typeof item.qty === 'number')
                numericQty = item.qty;
            if (numericQty !== null) {
                const norm = (0, mass_normalization_1.normalizeMass)(numericQty, item.unit || 'unit', database, item.name || item.id, overrides);
                if (norm) {
                    item.normalizedMass = (item.normalizedMass || 0) + norm.mass;
                    if (norm.isEstimate)
                        item.isEstimate = true;
                    item.conversionMethod = item.isEstimate ? 'estimate' : 'physical';
                }
            }
        }
        // Apply physical yields (waste factor adjustments, e.g. purchasing weight vs net weight)
        if (opts.enableYieldManagement !== false && item.normalizedMass && item.normalizedMass > 0) {
            const dbData = (0, ingredient_db_1.getIngredientData)(item.id, database);
            if (dbData && dbData.physical && dbData.physical.yield && dbData.physical.yield < 1) {
                const gross = item.normalizedMass / dbData.physical.yield;
                item.purchasingMass = parseFloat(gross.toFixed(2));
            }
        }
    });
    // 3. Estimate full nutritional profiles (calories, macros) based on portion counts
    let nutrition = undefined;
    if (opts.enableNutritionalEstimation !== false) {
        nutrition = (0, nutrition_1.calculateNutrition)(shopping_list, database, opts.portions || 1);
    }
    // 4. Assemble and return the final structurally and physically enriched recipe package
    const analyzedResult = {
        ...result,
        sections,
        shopping_list,
        metrics: {
            ...result.metrics,
            ...globalMassMetrics,
            nutrition
        }
    };
    return {
        result: analyzedResult,
        missingIngredients: Array.from(missingIngredientsSet)
    };
}

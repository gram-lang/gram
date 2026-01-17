"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureIngredientDb = void 0;
exports.compile = compile;
const utils_1 = require("./utils");
const shopping_1 = require("./shopping");
const nutrition_1 = require("./nutrition");
const processor_1 = require("./processor");
const metrics_1 = require("./metrics");
var ingredient_db_1 = require("./ingredient_db");
Object.defineProperty(exports, "configureIngredientDb", { enumerable: true, get: function () { return ingredient_db_1.configureIngredientDb; } });
function compile(ast) {
    if (ast.type !== 'Recipe')
        throw new Error("Compiler expects Recipe AST");
    const registry = {
        ingredients: new Map(),
        cookware: new Map(),
        warnings: []
    };
    const densityOverrides = {};
    if (ast.meta && ast.meta.densities) {
        const d = ast.meta.densities;
        const list = Array.isArray(d) ? d : [d];
        list.forEach((entry) => {
            const parts = entry.split(':');
            if (parts.length === 2) {
                const name = (0, utils_1.slugify)(parts[0]);
                const density = parseFloat(parts[1].trim());
                if (!isNaN(density)) {
                    densityOverrides[name] = density;
                }
            }
        });
    }
    const resultPayload = (0, processor_1.processSections)(ast.children, registry, densityOverrides);
    const sections = resultPayload.sections;
    sections.forEach(sec => {
        sec.metrics = (0, metrics_1.calculateMassMetrics)(sec.ingredients);
    });
    const allRawIngredients = [];
    sections.forEach(sec => {
        sec.ingredients.forEach(i => {
            if (i.type !== 'reference') {
                allRawIngredients.push(i);
            }
        });
    });
    const globalMassMetrics = (0, metrics_1.calculateMassMetrics)(allRawIngredients);
    // Generate warnings for missing mass data to help users debug
    const reportedMissing = new Set();
    globalMassMetrics.missingMassIngredients.forEach(name => {
        if (!reportedMissing.has(name)) {
            registry.warnings.push({
                code: 'MISSING_MASS_DATA',
                message: `Unable to calculate mass for '${name}'. Add it to the database or specify a physical unit (g, kg).`,
                item: name
            });
            reportedMissing.add(name);
        }
    });
    const shopping_list = (0, shopping_1.generateShoppingList)(sections, registry, densityOverrides);
    const globalCookware = [];
    sections.forEach(sec => {
        sec.cookware.forEach(cw => {
            if (!cw.modifiers || !cw.modifiers.includes('reference')) {
                globalCookware.push(cw);
            }
        });
    });
    const result = {
        title: ast.meta.title || null,
        slug: ast.meta.title ? (0, utils_1.slugify)(ast.meta.title) : null,
        meta: ast.meta,
        registry: {
            ingredients: Object.fromEntries(registry.ingredients),
            cookware: Object.fromEntries(registry.cookware)
        },
        shopping_list,
        cookware: globalCookware,
        sections,
        warnings: registry.warnings,
        metrics: {
            ...resultPayload.metrics,
            ...globalMassMetrics,
            preparationTime: (0, metrics_1.calculatePreparationTime)(sections, registry),
            nutrition: (() => {
                let portions = 1;
                if (ast.meta && ast.meta.portions) {
                    // Try to parse portions
                    const pText = Array.isArray(ast.meta.portions) ? ast.meta.portions[0] : ast.meta.portions;
                    if (pText) {
                        const match = pText.toString().match(/(\d+)/);
                        if (match) {
                            portions = parseInt(match[1], 10);
                        }
                    }
                }
                if (portions < 1)
                    portions = 1;
                const nutMetrics = (0, nutrition_1.calculateNutrition)(shopping_list, portions);
                // Inject Nutrition warnings into main registry
                if (nutMetrics.warnings) {
                    nutMetrics.warnings.forEach(w => {
                        registry.warnings.push({
                            code: 'NUTRITION_WARNING',
                            message: w
                        });
                    });
                }
                return nutMetrics;
            })()
        }
    };
    return (0, utils_1.cleanObject)(result);
}

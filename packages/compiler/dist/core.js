"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compile = compile;
const utils_1 = require("./utils");
const processor_1 = require("./processor");
const shopping_1 = require("./shopping");
const metrics_1 = require("./metrics");
/**
 * Main entry point of the Gram compiler.
 * Transforms a raw Recipe AST into a clean, structured CompilationResult
 * by compiling sections, generating the shopping list, and calculating preparation times.
 */
function compile(ast, options) {
    if (ast.type !== 'Recipe')
        throw new Error("Compiler expects Recipe AST");
    const registry = {
        ingredients: new Map(),
        cookware: new Map(),
        warnings: []
    };
    // 1. Process steps, scheduling, and build global registries
    const resultPayload = (0, processor_1.processSections)(ast.children, registry, options);
    const sections = resultPayload.sections;
    // 2. Aggregate ingredients into a master shopping list
    const shopping_list = (0, shopping_1.generateShoppingList)(sections, registry, options);
    // 3. Extract unique, non-reference cookware items globally
    const globalCookware = [];
    sections.forEach(sec => {
        sec.cookware.forEach(cw => {
            if (!cw.modifiers || !cw.modifiers.includes('reference')) {
                globalCookware.push(cw);
            }
        });
    });
    // 4. Assemble and return the clean, compact final compilation payload
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
            preparationTime: (0, metrics_1.calculatePreparationTime)(sections, registry)
        }
    };
    return (0, utils_1.cleanObject)(result);
}

import { slugify, cleanObject } from './utils';
import { applyScale } from './scale';
import { processSections } from './processor';
import { generateShoppingList } from './shopping';
import { calculatePreparationTime } from './metrics';
import { RecipeRegistry } from './registry';
import { RecipeAST } from '@gram-lang/parser';
import { Registry, CompilationResult, Usage } from './types';

import { z } from 'zod';
import { CompilerOptionsSchema } from './schemas';

export type CompilerOptions = z.infer<typeof CompilerOptionsSchema>;

/**
 * Main entry point of the Gram compiler.
 * Transforms a raw Recipe AST into a clean, structured CompilationResult
 * by compiling sections, generating the shopping list, and calculating preparation times.
 */
export function compile(ast: RecipeAST, rawOptions?: CompilerOptions): CompilationResult {
    const options = CompilerOptionsSchema.parse(rawOptions || {});
    if (ast.type !== 'Recipe') throw new Error("Compiler expects Recipe AST");

    const registry = new RecipeRegistry();

    // 1. Process steps, scheduling, and build global registries
    const resultPayload = processSections(ast.children, registry, options);
    const sections = resultPayload.sections;

    // 2. Aggregate ingredients into a master shopping list
    const shopping_list = generateShoppingList(sections, registry, options);
    
    // 3. Extract unique, non-reference cookware items globally
    const globalCookware: Usage[] = [];
    sections.forEach(sec => {
        sec.cookware.forEach(cw => {
             if (!cw.modifiers || !cw.modifiers.includes('reference')) {
                  globalCookware.push(cw);
             }
        });
    });

    // 4. Validate semantic rules (e.g., Baker's Percentage uniqueness)
    let bakersRefFound = false;
    sections.forEach(sec => {
        sec.ingredients.forEach(ing => {
            if (ing.modifiers && ing.modifiers.includes('bakers_percentage')) {
                if (bakersRefFound) {
                    throw new Error("MULTIPLE_BAKERS_PERCENTAGE: Only one ingredient can be marked with the baker's percentage (*) modifier in a recipe.");
                }
                bakersRefFound = true;
            }
        });
    });

    // 5. Assemble and return the clean, compact final compilation payload
    const result: CompilationResult = {
        title: (ast.meta as any).title || null,
        slug: (ast.meta as any).title ? slugify((ast.meta as any).title) : null,
        // Cloned defensively: compile() must never mutate the caller's AST,
        // since applyScale (and future in-place enrichers) writes to `meta`.
        meta: { ...(ast.meta as any) },
        registry: registry.toPlainObject(),
        shopping_list, 
        cookware: globalCookware,
        sections,
        warnings: registry.warnings,
        metrics: (() => {
            const prepTime = calculatePreparationTime(sections, registry);
            return {
                ...resultPayload.metrics,
                preparationTime: prepTime,
                totalTime: prepTime + resultPayload.metrics.cookTime
            };
        })()
    };

    const scaled = options.scaleFactor && options.scaleFactor !== 1
        ? applyScale(result, options.scaleFactor)
        : result;

    return cleanObject(scaled);
}

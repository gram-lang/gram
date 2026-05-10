
import { slugify, cleanObject } from './utils';
import { generateShoppingList } from './shopping';
import { calculateNutrition } from './nutrition';
import { processSections } from './processor';
import { calculateMassMetrics, calculatePreparationTime } from './metrics';
import { 
    RecipeAST, Registry, CompilationResult, Usage 
} from 'gram-parser';

export { configureIngredientDb } from './ingredient_db';

export interface CompilerOptions {
    enableMassNormalization?: boolean;
    enableYieldManagement?: boolean;
    enableNutritionalEstimation?: boolean;
}

export function compile(ast: RecipeAST, options?: CompilerOptions): CompilationResult {
    if (ast.type !== 'Recipe') throw new Error("Compiler expects Recipe AST");

    const registry: Registry = {
        ingredients: new Map(),
        cookware: new Map(),
        warnings: []
    };

    const densityOverrides: Record<string, number> = {};
    if (ast.meta && ast.meta.densities) {
        const d = ast.meta.densities;
        const list = Array.isArray(d) ? d : [d];
        list.forEach((entry: string) => {
            const parts = entry.split(':');
            if (parts.length === 2) {
                const name = slugify(parts[0]);
                const density = parseFloat(parts[1].trim());
                if (!isNaN(density)) {
                    densityOverrides[name] = density;
                }
            }
        });
    }

    const resultPayload = processSections(ast.children, registry, densityOverrides, options);
    const sections = resultPayload.sections;
    
    sections.forEach(sec => {
        sec.metrics = calculateMassMetrics(sec.ingredients);
    });

    const allRawIngredients: Usage[] = [];
    sections.forEach(sec => {
        sec.ingredients.forEach(i => {
            if (i.type !== 'reference') { 
                 allRawIngredients.push(i);
            }
        });
    });
    
    const globalMassMetrics = calculateMassMetrics(allRawIngredients);

    // Generate warnings for missing mass data to help users debug
    if (options?.enableMassNormalization !== false) {
        const reportedMissing = new Set<string>();
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
    }

    const shopping_list = generateShoppingList(sections, registry, densityOverrides, options);
    
    const globalCookware: Usage[] = [];
    sections.forEach(sec => {
        sec.cookware.forEach(cw => {
             if (!cw.modifiers || !cw.modifiers.includes('reference')) {
                  globalCookware.push(cw);
             }
        });
    });

    const result: CompilationResult = {
        title: (ast.meta as any).title || null,
        slug: (ast.meta as any).title ? slugify((ast.meta as any).title) : null,
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
            preparationTime: calculatePreparationTime(sections, registry),
            nutrition: (() => {
                if (!options?.enableNutritionalEstimation) return undefined;
                
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
                if (portions < 1) portions = 1;
                
                const nutMetrics = calculateNutrition(shopping_list, portions);
                
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

    return cleanObject(result);
}

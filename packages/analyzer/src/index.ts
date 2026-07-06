export * from './types';
export * from './ingredient_db';
export * from './mass_standardization';
export * from './nutrition';
export * from './metrics';
export * from './diff';
export * from './shopping_aggregation';


import type { CompilationResult } from '@gram-lang/kitchen';
import { getNumericQty } from '@gram-lang/kitchen';
import type { AnalyzedCompilationResult, AnalyzedUsage, AnalyzedSection, IngredientData, AnalysisResult, AnalyzerOptions } from './types';
import { ASTNodeType } from '@gram-lang/parser';
import { calculateMassMetrics } from './metrics';
import { calculateNutrition } from './nutrition';
import { standardizeMass, parseDensityOverrides, applyYield } from './mass_standardization';
import { getIngredientData } from './ingredient_db';
import { aggregateShoppingList } from './shopping_aggregation';
import { AnalyzerOptionsSchema, IngredientDataSchema } from './schemas';
import { z } from 'zod';

export function validateIngredientDatabase(rawDb: unknown): Record<string, IngredientData> {
    return z.record(z.string(), IngredientDataSchema).parse(rawDb);
}

/**
 * Main entry point for recipe physical analysis.
 * Takes a pure structural CompilationResult and a macro-ingredient database,
 * then enriches it with calculated masses, yields, and nutritional profiles.
 */
export function analyze(
    result: CompilationResult, 
    database: Record<string, IngredientData>,
    options?: AnalyzerOptions
): AnalysisResult {
    const opts = AnalyzerOptionsSchema.parse(options || {});
    const missingIngredientsSet = new Set<string>();
    
    // Deep clone the compiled sections to perform safe mutations while preserving internal references
    const sections: AnalyzedSection[] = typeof structuredClone === 'function'
        ? structuredClone(result.sections)
        : JSON.parse(JSON.stringify(result.sections));
    
    // Parse custom ingredient density overrides declared in YAML/Frontmatter metadata
    const overrides = parseDensityOverrides(result.meta);

    // 1. Traverse all recipe sections to calculate physical ingredient masses
    const allRawIngredients: AnalyzedUsage[] = [];
    sections.forEach(sec => {
        if (!sec.ingredients) sec.ingredients = [];
        sec.ingredients.forEach(item => {
            // Track ingredients missing from the database
            if (item.type !== 'reference' && item.id) {
                if (!getIngredientData(item.id, database)) {
                    missingIngredientsSet.add(item.id);
                }
            }

            // Perform physical mass normalization if enabled
            if (opts.enableMassStandardization !== false) {
                 const numericQty = getNumericQty(item.qty);

                 if (numericQty !== null) {
                      const norm = standardizeMass(numericQty, item.unit || 'unit', database, item.name || item.id, overrides);
                      if (norm) {
                           item.conversionMethod = norm.method;
                           item.isEstimate = norm.isEstimate;

                           const dbData = getIngredientData(item.id, database);
                           const yieldFactor = opts.enableYieldCalculation !== false ? dbData?.physical?.yield : undefined;
                           const yielded = applyYield(norm.mass, norm.method, yieldFactor);
                           item.normalizedMass = yielded.normalizedMass;
                           if (yielded.purchasingMass !== undefined) item.purchasingMass = yielded.purchasingMass;
                      }
                 }
            }
            if (item.type !== 'reference') { 
                 allRawIngredients.push(item);
            }
        });
        
        // Calculate mass metrics specifically for this section
        sec.metrics = calculateMassMetrics(sec.ingredients);
    });

    // Compute the global recipe mass totals
    const globalMassMetrics = calculateMassMetrics(allRawIngredients);

    // 1.5. Secondary pass: resolve Relative Quantities
    sections.forEach(sec => {
        sec.ingredients.forEach(item => {
            if (item.formula?.target) {
                const targetId = item.dependencies?.[0];
                const isVariable = item.formula.raw.includes('% of &');
                
                let targetMass = 0;
                let foundMass = false;
                
                if (!isVariable && targetId) {
                    sec.ingredients.forEach(other => {
                        if (other.id === targetId && other.normalizedMass !== undefined) {
                            targetMass += other.normalizedMass;
                            foundMass = true;
                        }
                    });
                }
                
                if (foundMass && targetMass > 0) {
                    const calculatedMass = (item.formula.percent / 100) * targetMass;
                    item.normalizedMass = parseFloat(calculatedMass.toFixed(2));
                    item.qty = { type: ASTNodeType.Quantity, value: item.normalizedMass, unit: 'g' } as any;
                    item.unit = 'g';
                    item.conversionMethod = 'relative';
                } else {
                    result.warnings.push({
                        code: 'RELATIVE_QUANTITY_UNKNOWN_MASS',
                        message: `Cannot compute relative quantity for '${item.name || item.id}' because the mass of target '${item.formula.target}' is unknown.`,
                        item: item.name || item.id
                    });
                }
            }
        });
    });

    // 1.8. Sync analyzed values back into step content objects using _usageId
    // (Because cleanObject deep clones during compilation, referential integrity is lost)
    sections.forEach(sec => {
        const usageMap = new Map<string, AnalyzedUsage>();
        sec.ingredients.forEach(i => { if (i._usageId) usageMap.set(i._usageId, i); });
        if (sec.cookware) {
            sec.cookware.forEach(c => { if (c._usageId) usageMap.set(c._usageId, c); });
        }
        
        sec.steps.forEach(step => {
            if (step.type === 'step' && Array.isArray(step.content)) {
                step.content.forEach((contentItem: any) => {
                    if (contentItem && typeof contentItem === 'object' && contentItem._usageId) {
                        const enriched = usageMap.get(contentItem._usageId);
                        if (enriched) {
                            if (enriched.normalizedMass !== undefined) contentItem.normalizedMass = enriched.normalizedMass;
                            if (enriched.qty !== undefined) contentItem.qty = enriched.qty;
                            if (enriched.unit !== undefined) contentItem.unit = enriched.unit;
                            if (enriched.conversionMethod !== undefined) contentItem.conversionMethod = enriched.conversionMethod;
                            if (enriched.isEstimate !== undefined) contentItem.isEstimate = enriched.isEstimate;
                            if (enriched.purchasingMass !== undefined) contentItem.purchasingMass = enriched.purchasingMass;
                        }
                    }
                });
            }
        });
    });

    // 2. Traverse and enrich the master Shopping List
    let shopping_list = result.shopping_list ? JSON.parse(JSON.stringify(result.shopping_list)) : [];
    shopping_list.forEach((item: any) => {
         if (opts.enableMassStandardization !== false) {
              if (item.type === 'composite' && Array.isArray(item.usage)) {
                   // For composites, sum children masses — NOT the parent unit weight.
                   // e.g. 6 egg yolks + 1 direct egg → 6×17g + 1×50g = 152g, not 7×50g = 350g.
                   let totalMass = 0;
                   let totalPurchasing = 0;
                   let hasEstimate = false;
                   for (const child of item.usage) {
                        const numericQty = getNumericQty(child.qty);
                        if (numericQty !== null) {
                             const norm = standardizeMass(numericQty, child.unit || 'unit', database, child.name || child.id, overrides);
                             if (norm) {
                                  const childDbData = getIngredientData(child.id, database);
                                  const childYieldFactor = opts.enableYieldCalculation !== false ? childDbData?.physical?.yield : undefined;
                                  const childYielded = applyYield(norm.mass, norm.method, childYieldFactor);

                                  child.normalizedMass = parseFloat(childYielded.normalizedMass.toFixed(2));
                                  child.isEstimate = norm.isEstimate;
                                  totalMass += childYielded.normalizedMass;
                                  totalPurchasing += childYielded.purchasingMass ?? childYielded.normalizedMass;
                                  if (norm.isEstimate) hasEstimate = true;
                             }
                        }
                   }
                   if (totalMass > 0) {
                        item.normalizedMass = parseFloat(totalMass.toFixed(2));
                        item.isEstimate = hasEstimate;
                        item.conversionMethod = hasEstimate ? 'estimate' : 'physical';
                        if (Math.abs(totalPurchasing - totalMass) > 0.001) {
                             item.purchasingMass = parseFloat(totalPurchasing.toFixed(2));
                        }
                   }
               } else {
                   const usageIds = item._usageIds || (item._usageId ? [item._usageId] : []);
                   const usages = allRawIngredients.filter(u => u._usageId && usageIds.includes(u._usageId));
                   let totalMass = 0;
                   let totalPurchasing = 0;
                   let hasEstimate = false;
                   let hasRelativeResolved = false;

                   usages.forEach(u => {
                       if (u.normalizedMass !== undefined) {
                           totalMass += u.normalizedMass;
                           totalPurchasing += u.purchasingMass ?? u.normalizedMass;
                           if (u.isEstimate) hasEstimate = true;
                           if (u.conversionMethod === 'relative') hasRelativeResolved = true;
                       }
                   });

                   if (totalMass > 0) {
                       item.normalizedMass = parseFloat(totalMass.toFixed(2));
                       item.isEstimate = hasEstimate;
                       // Preserve 'relative' provenance even if only some contributing
                       // usages were formula-derived: a mass partly built from another
                       // ingredient's percentage can't be treated as a physical anchor
                       // (e.g. for Baker's Math reference validation below).
                       item.conversionMethod = hasRelativeResolved ? 'relative' : (hasEstimate ? 'estimate' : 'physical');
                       if (Math.abs(totalPurchasing - totalMass) > 0.001) {
                            item.purchasingMass = parseFloat(totalPurchasing.toFixed(2));
                       }

                       if (hasRelativeResolved) {
                           item.qty = item.normalizedMass;
                           item.unit = 'g';
                           item.variable_entries = [];
                       }
                   }
               }
         }
    });

    // 2.8. Resolve database aliases and merge cross-unit entries for the same
    // canonical ingredient (e.g. "beurre"/"butter", or "100g" + "1 cup" of flour).
    if (opts.enableMassStandardization !== false) {
        shopping_list = aggregateShoppingList(shopping_list, database);
    }

    // 2.5 Calculate Baker's Percentages (if a reference is defined)
    let bakersReferenceMass: number | null = null;

    if (opts.enableBakersMath !== false) {
        // Find reference by explicit option or by the `*` modifier
        let bakersReferenceItem: any = null;
        for (const item of shopping_list) {
            if (
                (opts.bakersReference && item.id === opts.bakersReference) ||
                (item.modifiers?.includes('bakers_percentage'))
            ) {
                bakersReferenceItem = item;
                break;
            }
        }

        if (bakersReferenceItem && bakersReferenceItem.conversionMethod === 'relative') {
        // The 100% base must be a physical anchor. A reference whose own mass was
        // derived from another ingredient's percentage can't also be the base —
        // that's a circular definition, not a bug in the math, so we refuse
        // silently, disable Baker's Math for this run, and explain why.
        result.warnings.push({
            code: 'INVALID_BAKERS_REFERENCE',
            message: `Cannot use '${bakersReferenceItem.name || bakersReferenceItem.id}' as the Baker's Percentage reference: its quantity is itself computed from another ingredient's percentage, not an absolute mass.`,
            item: bakersReferenceItem.name || bakersReferenceItem.id
        });
    } else if (bakersReferenceItem) {
        bakersReferenceMass = bakersReferenceItem.normalizedMass || null;
    } else if (opts.bakersReference !== undefined) {
        // Baker's Math was explicitly requested (bare --bakers-math or
        // --bakers-reference=<id>) but nothing matched.
        result.warnings.push({
            code: 'NO_BAKERS_REFERENCE',
            message: `No Baker's Percentage reference found. Mark an ingredient with the \`*\` modifier, or pass --bakers-reference=<id>.`,
        });
    }

    if (bakersReferenceMass !== null && bakersReferenceMass > 0) {
        const computeBakers = (mass?: number) => 
            mass !== undefined ? parseFloat(((mass / bakersReferenceMass!) * 100).toFixed(2)) : undefined;

        // Apply to shopping list
        shopping_list.forEach((item: any) => {
            const bp = computeBakers(item.normalizedMass);
            if (bp !== undefined) item.bakersPercentage = bp;
        });
        
        // Apply to AST sections
        if (Array.isArray(sections)) {
            sections.forEach(section => {
                if (Array.isArray(section.ingredients)) {
                    section.ingredients.forEach((item: any) => {
                        const bp = computeBakers(item.normalizedMass);
                        if (bp !== undefined) item.bakersPercentage = bp;
                    });
                }
                if (Array.isArray(section.steps)) {
                    section.steps.forEach((step: any) => {
                        if (step && step.type === 'step' && Array.isArray(step.content)) {
                            step.content.forEach((node: any) => {
                                if (node && node.type === 'ingredient') {
                                    const bp = computeBakers(node.normalizedMass);
                                    if (bp !== undefined) node.bakersPercentage = bp;
                                }
                            });
                        }
                    });
                }
            });
        }
    }
    }

    // 3. Estimate full nutritional profiles (calories, macros) based on portion counts
    let nutrition: any ;
    if (opts.enableNutritionalEstimation !== false) {
         nutrition = calculateNutrition(shopping_list, database, opts.portions || 1);
    }

    // 4. Assemble and return the final structurally and physically enriched recipe package
    const analyzedResult: AnalyzedCompilationResult = {
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

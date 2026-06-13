export * from './types';
export * from './ingredient_db';
export * from './mass_normalization';
export * from './nutrition';
export * from './metrics';


import { CompilationResult, Usage } from '@gram/parser';
import { getNumericQty } from '@gram/compiler';
import { AnalyzedCompilationResult, AnalyzedUsage, AnalyzedSection, IngredientData, AnalysisResult, AnalyzerOptions } from './types';
import { calculateMassMetrics } from './metrics';
import { calculateNutrition } from './nutrition';
import { normalizeMass } from './mass_normalization';
import { getIngredientData } from './ingredient_db';
import { AnalyzerOptionsSchema, IngredientDataSchema } from './schemas';
import { z } from 'zod';

export function validateIngredientDatabase(rawDb: unknown): Record<string, IngredientData> {
    return z.record(IngredientDataSchema).parse(rawDb);
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
    
    // Deep clone the compiled sections to perform safe mutations
    const sections: AnalyzedSection[] = JSON.parse(JSON.stringify(result.sections));
    
    // Parse custom ingredient density overrides declared in YAML/Frontmatter metadata
    const overrides: Record<string, number> = {};
    if (result.meta && result.meta.densities) {
        const d = result.meta.densities;
        const list = Array.isArray(d) ? d : [d];
        list.forEach((entry: any) => {
            if (typeof entry !== 'string') return;
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
            if (opts.enableMassNormalization !== false) {
                 const numericQty = getNumericQty(item.qty);
                 
                 if (numericQty !== null) {
                      const norm = normalizeMass(numericQty, item.unit || 'unit', database, item.name || item.id, overrides);
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
        sec.metrics = calculateMassMetrics(sec.ingredients);
    });

    // Compute the global recipe mass totals
    const globalMassMetrics = calculateMassMetrics(allRawIngredients);

    // 2. Traverse and enrich the master Shopping List
    const shopping_list = result.shopping_list ? JSON.parse(JSON.stringify(result.shopping_list)) : [];
    shopping_list.forEach((item: any) => {
         // Resolve raw items to normalized grams
         if (opts.enableMassNormalization !== false) {
              const numericQty = getNumericQty(item.qty);
              if (numericQty !== null) {
                   const norm = normalizeMass(numericQty, item.unit || 'unit', database, item.name || item.id, overrides);
                   if (norm) {
                       item.normalizedMass = (item.normalizedMass || 0) + norm.mass;
                       if (norm.isEstimate) item.isEstimate = true;
                       item.conversionMethod = item.isEstimate ? 'estimate' : 'physical';
                   }
              }
         }
         
         // Apply physical yields (waste factor adjustments, e.g. purchasing weight vs net weight)
         if (opts.enableYieldManagement !== false && item.normalizedMass && item.normalizedMass > 0) {
              const dbData = getIngredientData(item.id, database);
              if (dbData && dbData.physical && dbData.physical.yield && dbData.physical.yield < 1) {
                  const gross = item.normalizedMass / dbData.physical.yield;
                  item.purchasingMass = parseFloat(gross.toFixed(2));
              }
         }
    });

    // 3. Estimate full nutritional profiles (calories, macros) based on portion counts
    let nutrition: any = undefined;
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

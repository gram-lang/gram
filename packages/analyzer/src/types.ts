import { z } from 'zod';
import { AnalyzerOptionsSchema, IngredientDataSchema } from './schemas';

export type AnalyzerOptions = z.infer<typeof AnalyzerOptionsSchema>;

import { Usage, ProcessedSection, CompilationResult } from '@gram/kitchen';

export interface MassMetrics {
    totalMass: number;
    massStatus: 'precise' | 'estimated' | 'incomplete';
    missingMassIngredients: string[];
}

export interface NutritionMetrics {
    total: {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        sugar?: number;
        fiber?: number;
        sodium?: number;
    };
    perPortion?: {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        sugar?: number;
        fiber?: number;
        sodium?: number;
    };
    isEstimate: boolean;
    coverage: number;
    warnings?: string[];
}

export type IngredientData = z.infer<typeof IngredientDataSchema>;

export interface AnalyzedUsage extends Usage {
    normalizedMass?: number;
    conversionMethod?: 'physical' | 'density' | 'unit_weight' | 'default' | 'explicit' | 'estimate' | 'relative';
    isEstimate?: boolean;
    purchasingMass?: number;
}

export interface AnalyzedSection extends ProcessedSection {
    ingredients: AnalyzedUsage[];
    cookware: AnalyzedUsage[];
    metrics?: MassMetrics;
}

export interface AnalyzedCompilationResult extends Omit<CompilationResult, 'sections' | 'metrics'> {
    sections: AnalyzedSection[];
    shopping_list: (AnalyzedUsage | any)[]; // Could define proper ShoppingListItem here
    metrics: CompilationResult['metrics'] & MassMetrics & {
        nutrition?: NutritionMetrics;
    };
}

export interface AnalysisResult {
    result: AnalyzedCompilationResult;
    missingIngredients: string[];
}

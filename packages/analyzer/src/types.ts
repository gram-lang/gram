export interface AnalyzerOptions {
    enableMassNormalization?: boolean;
    enableYieldManagement?: boolean;
    enableNutritionalEstimation?: boolean;
    portions?: number;
}

import { Usage, ProcessedSection, CompilationResult } from '@gram/parser';

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
        salt?: number;
    };
    perPortion?: {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        sugar?: number;
        fiber?: number;
        salt?: number;
    };
    isEstimate: boolean;
    coverage: number;
    warnings?: string[];
}

export interface IngredientData {
    name: string;
    physical?: {
        density: number;
        yield: number;
        unit_weight?: number;
    };
    states: Record<string, {
        macros?: {
            kcal: number;
            protein: number;
            carbs: number;
            fat: number;
            sugar?: number;
            fiber?: number;
            sodium?: number;
        };
    }>;
    aliases: string[];
}

export interface AnalyzedUsage extends Usage {
    normalizedMass?: number;
    conversionMethod?: 'physical' | 'density' | 'unit_weight' | 'default' | 'explicit' | 'estimate';
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

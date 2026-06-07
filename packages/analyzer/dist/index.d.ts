export * from './types';
export * from './ingredient_db';
export * from './mass_normalization';
export * from './nutrition';
export * from './metrics';
export * from './i18n';
import { CompilationResult } from '@gram/parser';
import { IngredientData, AnalysisResult, AnalyzerOptions } from './types';
/**
 * Main entry point for recipe physical analysis.
 * Takes a pure structural CompilationResult and a macro-ingredient database,
 * then enriches it with calculated masses, yields, and nutritional profiles.
 */
export declare function analyze(result: CompilationResult, database: Record<string, IngredientData>, options?: AnalyzerOptions): AnalysisResult;

import { NutritionMetrics, IngredientData } from './types';
export declare function calculateNutrition(ingredients: any[], database: Record<string, IngredientData>, portions?: number): NutritionMetrics;

interface Macros {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    sugar?: number;
    fiber?: number;
    salt?: number;
}
export interface NutritionMetrics {
    total: Macros;
    perPortion?: Macros;
    isEstimate: boolean;
    coverage: number;
    warnings?: string[];
}
export declare function calculateNutrition(ingredients: any[], portions?: number): NutritionMetrics;
export {};

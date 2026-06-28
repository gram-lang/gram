import { getNumericQty, WarningCode, pushWarning } from '@gram/kitchen';
import { getIngredientData } from './ingredient_db';
import { normalizeMass } from './mass_normalization';
import { NutritionMetrics, IngredientData, AnalyzedUsage } from './types';

interface Macros {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    sugar?: number;
    fiber?: number;
    sodium?: number;
}

export type NutritionItem = AnalyzedUsage & {
    usage?: NutritionItem[];
};

export function calculateNutrition(
    ingredients: NutritionItem[], 
    database: Record<string, IngredientData>,
    portions: number = 1
): NutritionMetrics {
    const total: Macros = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        sugar: 0,
        fiber: 0,
        sodium: 0
    };

    let metricsCount = 0;
    let knownCount = 0;
    const warnings: string[] = [];
    
    // Flatten composite ingredients and alternatives
    const flatList: NutritionItem[] = [];
    
    ingredients.forEach(item => {
        if (item.type === 'composite' && item.usage) {
             flatList.push(...item.usage);
        } else if (item.type === 'alternative') {
             if (item.options && item.options.length > 0) {
                 flatList.push(item.options[0]);
              }
        } else {
             flatList.push(item);
        }
    });

    flatList.forEach(item => {
        const id = item.id;
        if (!id) return;
        
        metricsCount++;

        let mass = 0;
        let isEst = false;

        // Try to obtain mass (reuse normalizedMass if available)
        if (item.normalizedMass) {
            mass = item.normalizedMass;
            if ((item as any).isEstimate) isEst = true;
        } else if (item.qty) {
            const val = getNumericQty(item.qty);
            if (val !== null) {
                const unit = item.unit || 'unit'; 
                
                const norm = normalizeMass(val, unit, database, item.name); 
                if (norm) {
                    mass = norm.mass;
                    isEst = norm.isEstimate;
                }
            }
        }

        if (mass > 0) {
            const data = getIngredientData(id, database);
            if (!data) {
                 pushWarning(warnings, WarningCode.MISSING_INGREDIENT, { id });
            } else if (data.nutrition) {
                knownCount++;
                const factor = mass / 100.0;
                
                const m = data.nutrition;
                total.calories += m.calories * factor;
                total.protein += m.protein * factor;
                total.carbs += m.carbs * factor;
                total.fat += m.fat * factor;
                
                if (m.sugar !== undefined) total.sugar = (total.sugar || 0) + m.sugar * factor;
                if (m.fiber !== undefined) total.fiber = (total.fiber || 0) + m.fiber * factor;
                if (m.sodium !== undefined) total.sodium = (total.sodium ?? 0) + m.sodium * factor;
                    
            } else {
                 pushWarning(warnings, WarningCode.MISSING_MACROS, { id });
            }
        } else {
            pushWarning(warnings, WarningCode.UNKNOWN_MASS, { id });
        }
    });

    const coverage = metricsCount > 0 ? knownCount / metricsCount : 0;

    // Rounding
    total.calories = Math.round(total.calories);
    total.protein = Math.round(total.protein * 10) / 10;
    total.carbs = Math.round(total.carbs * 10) / 10;
    total.fat = Math.round(total.fat * 10) / 10;
    if (total.sugar !== undefined) total.sugar = Math.round(total.sugar * 10) / 10;
    if (total.fiber !== undefined) total.fiber = Math.round(total.fiber * 10) / 10;
    if (total.sodium !== undefined) total.sodium = Math.round(total.sodium * 100) / 100;

    const res: NutritionMetrics = {
        total,
        isEstimate: true, 
        coverage,
        warnings: warnings.length > 0 ? warnings : undefined
    };

    if (portions > 1) {
        res.perPortion = {
            calories: Math.round(total.calories / portions),
            protein: Math.round(total.protein / portions * 10) / 10,
            carbs: Math.round(total.carbs / portions * 10) / 10,
            fat: Math.round(total.fat / portions * 10) / 10,
            sugar: total.sugar !== undefined ? Math.round(total.sugar / portions * 10) / 10 : 0,
            fiber: total.fiber !== undefined ? Math.round(total.fiber / portions * 10) / 10 : 0,
            sodium: total.sodium !== undefined ? Math.round(total.sodium / portions * 100) / 100 : 0
        };
    }

    return res;
}

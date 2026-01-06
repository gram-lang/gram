import { Usage } from 'gram-parser';
import { getIngredientData } from './ingredient_db';
import { normalizeMass } from './mass_normalization';

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
    coverage: number; // 0-1, how many ingredients had macros
}

export function calculateNutrition(ingredients: any[], portions: number = 1): NutritionMetrics {
    const total: Macros = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        sugar: 0,
        fiber: 0,
        salt: 0
    };

    let metricsCount = 0;
    let knownCount = 0;
    
    // Flatten composite ingredients and alternatives
    const flatList: Usage[] = [];
    
    ingredients.forEach(item => {
        if (item.type === 'composite' && item.usage) {
             flatList.push(item);
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

        // Try to calculate mass
        if (item.qty && (typeof item.qty === 'number' || (item.qty as any).value)) {
            const val = typeof item.qty === 'number' ? item.qty : (item.qty as any).value;
            const unit = item.unit || 'unit'; 
            
            const norm = normalizeMass(val, unit, item.name); 
            if (norm) {
                mass = norm.mass;
                isEst = norm.isEstimate;
            }
        }

        if (mass > 0) {
            const data = getIngredientData(id);
            if (data && data.macros) {
                knownCount++;
                const factor = mass / 100.0;
                total.calories += data.macros.calories * factor;
                total.protein += data.macros.protein * factor;
                total.carbs += data.macros.carbs * factor;
                total.fat += data.macros.fat * factor;
                
                if (data.macros.sugar !== undefined) total.sugar = (total.sugar || 0) + data.macros.sugar * factor;
                if (data.macros.fiber !== undefined) total.fiber = (total.fiber || 0) + data.macros.fiber * factor;
                if (data.macros.salt !== undefined) total.salt = (total.salt || 0) + data.macros.salt * factor;
            }
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
    if (total.salt !== undefined) total.salt = Math.round(total.salt * 100) / 100; // Salt often small

    const res: NutritionMetrics = {
        total,
        isEstimate: true, 
        coverage
    };

    if (portions > 1) {
        res.perPortion = {
            calories: Math.round(total.calories / portions),
            protein: Math.round(total.protein / portions * 10) / 10,
            carbs: Math.round(total.carbs / portions * 10) / 10,
            fat: Math.round(total.fat / portions * 10) / 10,
            sugar: total.sugar !== undefined ? Math.round(total.sugar / portions * 10) / 10 : 0,
            fiber: total.fiber !== undefined ? Math.round(total.fiber / portions * 10) / 10 : 0,
            salt: total.salt !== undefined ? Math.round(total.salt / portions * 100) / 100 : 0
        };
    }

    return res;
}

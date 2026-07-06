import { getNumericQty, WarningCode, pushWarning } from '@gram-lang/kitchen';
import { getIngredientData } from './ingredient_db';
import { standardizeMass } from './mass_standardization';
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
        // Optional ingredients (`?`) are excluded from the conservative baseline —
        // skip the whole item (and its composite children/alternative options) up front.
        if (item.modifiers?.includes('optional')) return;

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
        // A composite child or alternative option can carry its own `optional` modifier
        // even when the parent/group wasn't marked optional as a whole.
        if (item.modifiers?.includes('optional')) return;

        // Ingredients declared without a quantity (@salt{}, @oil) have negligible/trace mass.
        // They are intentional "to taste" entries — skip silently, no warning, no coverage hit.
        if (item.qty == null && !item.normalizedMass) return;

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

                // item.name may be undefined for composite children (usage items only carry id+qty)
                const norm = standardizeMass(val, unit, database, item.name || item.id);
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
    if (total.sodium !== undefined) total.sodium = Math.round(total.sodium); // mg → integer

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
            sodium: total.sodium !== undefined ? Math.round(total.sodium / portions) : 0
        };
    }

    return res;
}

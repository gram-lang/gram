import { Usage } from 'gram-parser';
import { getIngredientData } from './ingredient_db';
import { normalizeMass } from './mass_normalization';
import { resolveState } from './i18n';

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
    warnings?: string[];
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
    const warnings: string[] = [];
    
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

        // Try to obtain mass (reuse normalizedMass if available)
        if (item.normalizedMass) {
            mass = item.normalizedMass;
            // We don't overwrite isEst here because normalizedMass already accounts for it on item.isEstimate usually, 
            // but let's trust the item.
            if ((item as any).isEstimate) isEst = true;
        } else if (item.qty && (typeof item.qty === 'number' || (item.qty as any).value)) {
            // Fallback for items that might not have normalizedMass set (e.g. from some other source?)
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
            if (!data) {
                 warnings.push(`MISSING_INGREDIENT: "${id}" not found in database.`);
            } else if (data.states) {
                knownCount++;
                const factor = mass / 100.0;
                
                // Resolve State (canonical key)
                const stateRaw = item.state || 'default';
                const stateKey = resolveState(stateRaw);

                let targetState = 'default';
                
                if (data.states[stateKey]) {
                    targetState = stateKey;
                } else {
                    // Fallback to default if canonical key not found
                    // Only warn if the USER provided state was not 'default' but resolved to something unknown
                    if (stateKey !== 'default') {
                         warnings.push(`UNKNOWN_STATE: Ingredient "${id}": Unknown state "${stateRaw}" (resolved: "${stateKey}"), using default macros.`);
                    }
                }

                const stateData = data.states[targetState] || data.states['default'];
                
                if (stateData && stateData.macros) {
                    const m = stateData.macros;
                    total.calories += m.kcal * factor;
                    total.protein += m.protein * factor;
                    total.carbs += m.carbs * factor;
                    total.fat += m.fat * factor;
                    
                    if (m.sugar !== undefined) total.sugar = (total.sugar || 0) + m.sugar * factor;
                    if (m.fiber !== undefined) total.fiber = (total.fiber || 0) + m.fiber * factor;
                    
                    // sodium -> salt (approx x2.5 or if sodium is actually salt in YAML?) 
                    // YAML schema has sodium, UI displays salt usually. 
                    // CIQUAL often calls it "Salt". But schema says "Sodium".
                    // Standard conversion: Salt = Sodium * 2.5
                    // But if the DB stores salt directly, we just sum.
                    // The schema says sodium: z.number().optional(). 
                    // Let's assume input is Sodium (mg or g? usually g/100g in these files).
                    if (m.sodium !== undefined) total.salt = (total.salt || 0) + m.sodium * factor;
                    
                } else {
                     warnings.push(`MISSING_MACROS: Ingredient "${id}" (state: ${targetState}) has no macro data.`);
                }
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
            salt: total.salt !== undefined ? Math.round(total.salt / portions * 100) / 100 : 0
        };
    }

    return res;
}

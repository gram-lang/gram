import { slugify } from '@gram/compiler';
import { normalizeUnit } from '@gram/i18n';

export interface UnitMap {
    base: string;
    map: Record<string, number>;
}

export const UNIT_CONVERSIONS = {
    mass: {
        base: 'g',
        map: {
            mg: 0.001, g: 1, kg: 1000,
            oz: 28.3495, lb: 453.592,
        },
    },
    volume: {
        base: 'ml',
        map: {
            ml: 1, cl: 10, dl: 100, l: 1000,
            tsp: 4.9289, tbsp: 14.7868,
            cup: 236.588,
            pt: 473.176, qt: 946.353, gal: 3785.41,
            'fl oz': 29.5735,
        },
    },
};

import { getIngredientData } from './ingredient_db';
import { IngredientData } from './types';

/**
 * Mass Normalization Module
 * 
 * Responsible for converting physical mass units into a standard GRAM unit (g).
 */

interface ConversionResult {
    mass: number;
    method: 'physical' | 'density' | 'unit_weight' | 'default' | 'explicit';
}

export function normalizeMass(
    amount: number, 
    unit: string, 
    database: Record<string, IngredientData>,
    ingredientName?: string, 
    overrides?: Record<string, number>
): ConversionResult & { isEstimate: boolean } | null {
    if (!unit) {
        return null;
    }
    
    const u = normalizeUnit(unit);

    // 1. Physical Mass
    const massMap: Record<string, number> = UNIT_CONVERSIONS.mass.map;
    const massFactor = massMap[u];
    if (massFactor !== undefined) {
        return { mass: amount * massFactor, method: 'physical', isEstimate: false };
    }

    // 2. Volume -> Density
    const volMap: Record<string, number> = UNIT_CONVERSIONS.volume.map;
    const volFactor = volMap[u];
    if (volFactor !== undefined) {
        const volumeMl = amount * volFactor;
        let density = 1.0; // Default Water
        let method: 'density' | 'default' | 'explicit' = 'default';

        if (ingredientName) {
            // Check overrides first
            const slug = slugify(ingredientName);
            const overrideDensity = overrides ? overrides[slug] : undefined;
            if (overrideDensity !== undefined) {
                density = overrideDensity;
                method = 'explicit';
            } else {
                const data = getIngredientData(ingredientName, database);
                if (data && data.physical) {
                    density = data.physical.density;
                    method = 'density';
                }
            }
        }
        return { 
            mass: volumeMl * density, 
            method,
            isEstimate: method !== 'explicit' 
        };
    }

    // 3. Fallback: Treat unknown units as Count/Unit units
    // e.g. "clove", "head", "stick", "slice" -> treated as "1 unit" multiplier
    if (ingredientName) {
        // Check overrides first
        const slug = slugify(ingredientName);
        const unitWt = overrides ? overrides[slug] : undefined;
        if (unitWt !== undefined) {
            return { 
                mass: amount * unitWt, 
                method: 'explicit', 
                // Careful: If the override was meant for density (g/ml), this might be ambiguous?
                // But generally overrides for non-volume things imply unit weight.
                isEstimate: false 
            };
        }

        const data = getIngredientData(ingredientName, database);
        if (data && data.physical && data.physical.unit_weight) {
            return { mass: amount * data.physical.unit_weight, method: 'unit_weight', isEstimate: true };
        }
    }

    return null;
}

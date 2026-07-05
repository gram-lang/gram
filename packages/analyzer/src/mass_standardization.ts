import { slugify } from '@gram/kitchen';
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
            drop: 0.078, smidgen: 0.156, pinch: 0.3125, dash: 0.625, tad: 1.25,
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

/**
 * Converts a value between two units of the same physical family (mass-to-mass,
 * or volume-to-volume), using the same UNIT_CONVERSIONS table standardizeMass
 * relies on. Returns null for cross-family conversions (mass <-> volume), since
 * those require an ingredient-specific density and can't be done with a pure
 * unit table — callers should surface that as a distinct error rather than guess.
 */
export function convertUnit(value: number, fromUnit: string, toUnit: string): number | null {
    const from = normalizeUnit(fromUnit);
    const to = normalizeUnit(toUnit);
    if (from === to) return value;

    for (const family of [UNIT_CONVERSIONS.mass, UNIT_CONVERSIONS.volume]) {
        const map: Record<string, number> = family.map;
        const fromFactor = map[from];
        const toFactor = map[to];
        if (fromFactor !== undefined && toFactor !== undefined) {
            return (value * fromFactor) / toFactor;
        }
    }
    return null;
}

export function standardizeMass(
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
        if (ingredientName) {
            // Check overrides first
            const slug = slugify(ingredientName);
            const overrideDensity = overrides ? overrides[slug] : undefined;
            if (overrideDensity !== undefined) {
                return { 
                    mass: volumeMl * overrideDensity, 
                    method: 'explicit',
                    isEstimate: false 
                };
            } else {
                const data = getIngredientData(ingredientName, database);
                if (data && data.physical && data.physical.density) {
                    return { 
                        mass: volumeMl * data.physical.density, 
                        method: 'density',
                        isEstimate: true 
                    };
                }
            }
        }
        
        // If we reach here, we have a volume unit but NO density available.
        // We refuse to blindly guess (e.g. density=1.0) because it creates false
        // aggregations in shopping lists (e.g. 1 cup of flour != 240g).
        // By returning null, the item will be listed by its raw unit.
        return null;
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

export interface UnitMap {
    base: string;
    map: Record<string, number>;
}
export declare const UNIT_CONVERSIONS: Record<string, UnitMap>;
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
export declare function normalizeMass(amount: number, unit: string, database: Record<string, IngredientData>, ingredientName?: string, overrides?: Record<string, number>): ConversionResult & {
    isEstimate: boolean;
} | null;
export {};

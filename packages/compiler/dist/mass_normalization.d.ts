/**
 * Mass Normalization Module
 *
 * Responsible for converting physical mass units into a standard GRAM unit (g).
 */
interface ConversionResult {
    mass: number;
    method: 'physical' | 'density' | 'unit_weight' | 'default' | 'explicit';
}
export declare function normalizeMass(amount: number, unit: string, ingredientName?: string, overrides?: Record<string, number>): ConversionResult & {
    isEstimate: boolean;
} | null;
export {};

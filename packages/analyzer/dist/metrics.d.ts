import { MassMetrics } from './types';
/**
 * Calculates mass metrics (totals, precision status, and missing data warnings)
 * for a list of ingredient usages by querying their normalized masses.
 */
export declare function calculateMassMetrics(ingredients: any[]): MassMetrics;

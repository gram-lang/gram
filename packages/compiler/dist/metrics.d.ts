import { ProcessedSection, Registry } from '@gram/parser';
/**
 * Calculates the total active preparation time (in minutes) for a recipe.
 *
 * Sums base lookup overhead (gathering ingredients & cookware) and adds
 * active preparation times (e.g. chopping, peeling) declared on ingredients.
 */
export declare function calculatePreparationTime(sections: ProcessedSection[], registry: Registry): number;

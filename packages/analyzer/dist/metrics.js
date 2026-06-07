"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateMassMetrics = calculateMassMetrics;
/**
 * Calculates mass metrics (totals, precision status, and missing data warnings)
 * for a list of ingredient usages by querying their normalized masses.
 */
function calculateMassMetrics(ingredients) {
    let totalMass = 0;
    const missing = [];
    let hasEstimates = false;
    let hasPrecise = false;
    ingredients.forEach(item => {
        // Handle alternatives by picking the first option as the representative mass
        let target = item;
        if (item.type === 'alternative' && item.options && item.options.length > 0) {
            target = item.options[0];
        }
        if (target.normalizedMass !== undefined) {
            totalMass += target.normalizedMass;
            if (target.isEstimate)
                hasEstimates = true;
            else
                hasPrecise = true;
        }
        else {
            // Log missing physical data for raw, non-functional ingredients
            if (target.type !== 'cookware' && target.type !== 'timer' && target.type !== 'temperature' && target.type !== 'reference') {
                missing.push(target.name || target.id || '?');
            }
        }
    });
    // Determine the overall confidence level of the mass calculations
    let status = 'precise';
    if (missing.length > 0)
        status = 'incomplete';
    else if (hasEstimates)
        status = 'estimated';
    else if (!hasPrecise && !hasEstimates)
        status = 'incomplete'; // Safe fallback for empty lists
    return {
        totalMass: parseFloat(totalMass.toFixed(2)),
        massStatus: status,
        missingMassIngredients: missing
    };
}

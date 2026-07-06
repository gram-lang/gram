import type { ProcessedSection, Registry } from './types';

/**
 * Calculates the total active preparation time (in minutes) for a recipe.
 * 
 * Sums base lookup overhead (gathering ingredients & cookware) and adds 
 * active preparation times (e.g. chopping, peeling) declared on ingredients.
 */
export function calculatePreparationTime(sections: ProcessedSection[], registry: Registry): number {
    let t = 0;
    
    // Base overhead: 1 minute per unique ingredient and cookware item
    t += registry.ingredients.size * 1;
    t += registry.cookware.size * 1;

    // Helper to recursively calculate prep time for a single item (handles alternatives)
    const countPrep = (item: any): number => {
        let localTime = 0;
        if (!item) return 0;
        
        // Add 2 minutes if the ingredient requires preparation (e.g. "chopped", "peeled")
        if (item.type === 'ingredient' && item.preparation) {
                localTime += 2;
        }
        
        if (item.options && Array.isArray(item.options)) {
            // For alternative choices, take the longest preparation path
            let maxOpt = 0;
            item.options.forEach((opt: any) => {
                    const optTime = countPrep(opt);
                    if (optTime > maxOpt) maxOpt = optTime;
            });
            localTime += maxOpt;
        } else if (!item.type && item.id && item.preparation) { 
            localTime += 2;
        }
        
        return localTime;
    };

    // Aggregate preparation time across all steps and sections
    sections.forEach(sec => {
        sec.steps.forEach(s => {
            if (s.type === 'step' && s.content) {
                s.content.forEach((c: any) => {
                    t += countPrep(c);
                });
            }
        });
    });
    return t;
}

import { Usage, MassMetrics, ProcessedSection, Registry } from 'gram-parser';

export function calculateMassMetrics(ingredients: Usage[]): MassMetrics {
    let totalMass = 0;
    let missing: string[] = [];
    let isEstimated = false;

    ingredients.forEach(i => {
        let target = i;
        if ((i.type === 'alternative' || i.type === 'group') && i.options && i.options.length > 0) {
            target = i.options[0];
        }

        if (target.normalizedMass !== undefined) {
            totalMass += target.normalizedMass;
            if (target.isEstimate) isEstimated = true;
        } else {
            const type = target.type || 'ingredient';
            const validTypes = ['ingredient', 'reference', 'alternative', 'group'];
            if (validTypes.includes(type) || !target.type) {
                 missing.push(target.name || target.id);
            }
        }
    });

    let status: 'precise' | 'estimated' | 'incomplete' = 'precise';
    if (missing.length > 0) status = 'incomplete';
    else if (isEstimated) status = 'estimated';

    return { 
        totalMass: parseFloat(totalMass.toFixed(2)), 
        massStatus: status, 
        missingMassIngredients: missing 
    };
}

export function calculatePreparationTime(sections: ProcessedSection[], registry: Registry): number {
    let t = 0;
    t += registry.ingredients.size * 1;
    t += registry.cookware.size * 1;

    const countPrep = (item: any): number => {
        let localTime = 0;
        if (!item) return 0;
        
        if (item.type === 'ingredient' && item.preparation) {
                localTime += 2;
        }
        
        if (item.options && Array.isArray(item.options)) {
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

    sections.forEach(sec => {
        sec.steps.forEach(s => {
                if (s.content) s.content.forEach((c: any) => {
                    t += countPrep(c);
                });
        });
    });
    return t;
}

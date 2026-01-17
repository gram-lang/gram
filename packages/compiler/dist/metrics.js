"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateMassMetrics = calculateMassMetrics;
exports.calculatePreparationTime = calculatePreparationTime;
function calculateMassMetrics(ingredients) {
    let totalMass = 0;
    let missing = [];
    let isEstimated = false;
    ingredients.forEach(i => {
        let target = i;
        if ((i.type === 'alternative' || i.type === 'group') && i.options && i.options.length > 0) {
            target = i.options[0];
        }
        if (target.normalizedMass) {
            totalMass += target.normalizedMass;
            if (target.isEstimate)
                isEstimated = true;
        }
        else {
            const type = target.type || 'ingredient';
            const validTypes = ['ingredient', 'reference', 'alternative', 'group'];
            if (validTypes.includes(type) || !target.type) {
                missing.push(target.name || target.id);
            }
        }
    });
    let status = 'precise';
    if (missing.length > 0)
        status = 'incomplete';
    else if (isEstimated)
        status = 'estimated';
    return {
        totalMass: parseFloat(totalMass.toFixed(2)),
        massStatus: status,
        missingMassIngredients: missing
    };
}
function calculatePreparationTime(sections, registry) {
    let t = 0;
    t += registry.ingredients.size * 1;
    t += registry.cookware.size * 1;
    const countPrep = (item) => {
        let localTime = 0;
        if (!item)
            return 0;
        if (item.type === 'ingredient' && item.preparation) {
            localTime += 2;
        }
        if (item.options && Array.isArray(item.options)) {
            let maxOpt = 0;
            item.options.forEach((opt) => {
                const optTime = countPrep(opt);
                if (optTime > maxOpt)
                    maxOpt = optTime;
            });
            localTime += maxOpt;
        }
        else if (!item.type && item.id && item.preparation) {
            localTime += 2;
        }
        return localTime;
    };
    sections.forEach(sec => {
        sec.steps.forEach(s => {
            if (s.content)
                s.content.forEach((c) => {
                    t += countPrep(c);
                });
        });
    });
    return t;
}

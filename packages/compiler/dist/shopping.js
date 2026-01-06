"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateShoppingList = generateShoppingList;
const utils_1 = require("./utils");
const mass_normalization_1 = require("./mass_normalization");
const ingredient_db_1 = require("./ingredient_db");
const graph_1 = require("./graph");
function formatQuantity(q) {
    if (!q)
        return '';
    if (typeof q === 'number')
        return q;
    // Handle objects
    if (q.type === 'single')
        return q.value;
    if (q.type === 'range')
        return q.text || `${q.value}`;
    if (q.type === 'fraction')
        return q.text || `${q.value}`;
    return JSON.stringify(q);
}
function generateShoppingList(sections, registry, overrides) {
    const listMap = new Map();
    const compositeMap = new Map();
    const alternatives = [];
    const circularIds = (0, graph_1.detectCycles)(sections);
    sections.forEach(sec => {
        sec.ingredients.forEach(item => {
            // Handle Alternatives explicitly
            if (item.type === 'alternative') {
                alternatives.push(item);
                return;
            }
            // Mark circular on item if detected
            if (circularIds.has(item.id)) {
                item.isCircular = true;
            }
            if (item.composite) {
                const parentId = (0, utils_1.slugify)(item.composite.parent);
                if (!compositeMap.has(parentId)) {
                    compositeMap.set(parentId, {
                        type: 'composite',
                        id: parentId,
                        qty: 0,
                        usage: [],
                        _subUsageMap: new Map(),
                        _usageAccumulator: new Map()
                    });
                }
                const comp = compositeMap.get(parentId);
                // Accumulate Parent Quantity Requirement
                let declParentQty = 0;
                if (item.composite && item.composite.quantity) {
                    const minQ = (0, utils_1.minifyQuantity)(item.composite.quantity);
                    if (typeof minQ === 'number')
                        declParentQty = minQ;
                }
                const subId = item.id;
                const currentParentTotal = comp._subUsageMap.get(subId) || 0;
                comp._subUsageMap.set(subId, currentParentTotal + declParentQty);
                // Accumulate Usage (Child Quantity)
                const uUnit = item.unit || '';
                const uKey = `${subId}::${uUnit}`;
                if (!comp._usageAccumulator.has(uKey)) {
                    comp._usageAccumulator.set(uKey, {
                        id: subId,
                        unit: item.unit,
                        qty: 0,
                        alias: item.alias
                    });
                }
                const uEntry = comp._usageAccumulator.get(uKey);
                let childVal = 0;
                if (typeof item.qty === 'number') {
                    childVal = item.qty;
                }
                else if (item.qty && typeof item.qty === 'object') {
                    const m = (0, utils_1.minifyQuantity)(item.qty);
                    if (typeof m === 'number')
                        childVal = m;
                }
                if (typeof uEntry.qty === 'number') {
                    uEntry.qty += childVal;
                }
                return;
            }
            const id = item.id;
            const key = id;
            if (!listMap.has(key)) {
                listMap.set(key, {
                    id: id,
                    name: registry.ingredients.get(id)?.name || item.name,
                    sureMass: 0,
                    otherUnits: {},
                    variableParts: [],
                    _hasSure: false,
                    normalizedMass: 0,
                    isEstimate: false,
                    conversionMethod: 'physical' // default
                });
            }
            const existing = listMap.get(key);
            // LOGIC: Resolve Quantity to Number if possible
            let numericQty = null;
            let unit = item.unit || '';
            let isGhost = false;
            // Check if Relative
            if (item.formula) {
                if (item.formula.isGhost) {
                    isGhost = true;
                }
                else {
                    // Calculated relative
                    if (typeof item.qty === 'number') {
                        numericQty = item.qty;
                    }
                }
            }
            else {
                // Absolute
                if (typeof item.qty === 'number') {
                    numericQty = item.qty;
                }
                else if (item.qty && typeof item.qty === 'object') {
                    const qObj = item.qty;
                    if (qObj.type === 'fraction')
                        numericQty = qObj.value;
                    else if (qObj.type === 'range')
                        numericQty = qObj.value;
                    else if (qObj.type === 'single')
                        numericQty = qObj.value;
                }
            }
            if (isGhost) {
                // GHOST HANDLING
                let text = item.formula ? item.formula.raw : (item.qty && item.qty.value) || '';
                if (item.formula) {
                    text = item.formula.raw;
                }
                const display = `${text} ❓`;
                existing.variableParts.push(`(${display})`);
            }
            else if (numericQty !== null) {
                // 1. Calculate Mass for Badge (Total Normalized)
                const norm = (0, mass_normalization_1.normalizeMass)(numericQty, unit, existing.name, overrides);
                if (norm) {
                    existing.normalizedMass = (existing.normalizedMass || 0) + norm.mass;
                    if (norm.isEstimate)
                        existing.isEstimate = true;
                }
                // 2. Aggregation Logic for Display (Physical vs Other)
                if (norm && norm.method === 'physical') {
                    existing.sureMass += norm.mass;
                    existing._hasSure = true;
                }
                else {
                    const u = unit;
                    if (!existing.otherUnits[u])
                        existing.otherUnits[u] = 0;
                    existing.otherUnits[u] += numericQty;
                }
            }
            else {
                // Unresolved or Just Variable
                if (item.qty) {
                    const qStr = formatQuantity(item.qty);
                    const uStr = unit ? ` ${unit}` : '';
                    existing.variableParts.push(`${qStr}${uStr}`);
                }
            }
            if (!isGhost && item.isCircular) {
                existing.variableParts.push("⚠️ Ref. Circulaire");
            }
        });
    });
    const standardList = [...listMap.values()].map(item => {
        const res = {
            id: item.id,
            name: item.name,
            normalizedMass: item.normalizedMass,
            isEstimate: item.isEstimate,
            conversionMethod: item.isEstimate ? 'estimate' : 'physical'
        };
        // Determine main Qty/Unit
        if (item.sureMass > 0) {
            res.qty = parseFloat(item.sureMass.toFixed(2));
            res.unit = 'g';
        }
        else {
            const units = Object.keys(item.otherUnits);
            if (units.length > 0) {
                res.qty = parseFloat(item.otherUnits[units[0]].toFixed(2));
                res.unit = units[0] || null;
            }
        }
        // --- Gross Mass Calculation (Yield) ---
        // Only if we have a normalized mass (Net) and the ingredient has a yield factor < 1
        if (res.normalizedMass && res.normalizedMass > 0) {
            const dbData = (0, ingredient_db_1.getIngredientData)(item.id);
            if (dbData && dbData.yield && dbData.yield < 1) {
                const gross = res.normalizedMass / dbData.yield;
                res.purchasingMass = parseFloat(gross.toFixed(2));
            }
        }
        const hasMass = item.sureMass > 0;
        const hasOther = Object.keys(item.otherUnits).length > 0;
        const extraEntries = [];
        if (hasMass) {
            // Mass is in Qty. Any other units are extra.
            for (const [u, q] of Object.entries(item.otherUnits)) {
                const uStr = u ? ` ${u}` : '';
                extraEntries.push(`${parseFloat(q.toFixed(2))}${uStr}`);
            }
        }
        else if (hasOther) {
            // First unit is in Qty. Others are extra.
            const units = Object.keys(item.otherUnits);
            for (let i = 1; i < units.length; i++) {
                const u = units[i];
                const uStr = u ? ` ${u}` : '';
                extraEntries.push(`${parseFloat(item.otherUnits[u].toFixed(2))}${uStr}`);
            }
        }
        const allVars = [...extraEntries, ...(item.variableParts || [])];
        if (allVars.length > 0) {
            res.variable_entries = allVars;
        }
        return res;
    });
    const compositeList = [...compositeMap.values()].map(c => {
        let maxQ = 0;
        for (const q of c._subUsageMap.values()) {
            if (q > maxQ)
                maxQ = q;
        }
        c.qty = maxQ;
        // Calculate Mass for Parent Composite
        // Composite parents are almost always counted units (e.g. 6 eggs)
        // If an explicit unit exists in composite definition we should use it, but here we infer 'unit' from maxQ usually being unitless count
        const parentName = registry.ingredients.get(c.id)?.name || c.id;
        const parentNorm = (0, mass_normalization_1.normalizeMass)(c.qty, 'unit', parentName, overrides);
        let cRes = {
            type: 'composite',
            id: c.id,
            name: parentName,
            qty: c.qty,
            usage: [] // Will populate below
        };
        if (parentNorm) {
            cRes.normalizedMass = parentNorm.mass;
            cRes.isEstimate = parentNorm.isEstimate;
            cRes.conversionMethod = parentNorm.method;
        }
        // Calculate Mass for Sub-usages
        cRes.usage = [...c._usageAccumulator.values()].map(u => {
            const childUsage = { ...u };
            if (u.qty && typeof u.qty === 'number') {
                const childId = u.id || '';
                const childName = registry.ingredients.get(childId)?.name || childId;
                const childNorm = (0, mass_normalization_1.normalizeMass)(u.qty, u.unit || '', childName, overrides);
                if (childNorm) {
                    childUsage.normalizedMass = childNorm.mass;
                    childUsage.isEstimate = childNorm.isEstimate;
                    childUsage.conversionMethod = childNorm.method;
                }
            }
            return childUsage;
        });
        return cRes;
    });
    return [
        ...standardList,
        ...compositeList,
        ...alternatives
    ];
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateShoppingList = generateShoppingList;
const utils_1 = require("./utils");
const mass_normalization_1 = require("./mass_normalization");
const ingredient_db_1 = require("./ingredient_db");
const graph_1 = require("./graph");
const i18n_1 = require("./i18n");
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
function generateShoppingList(sections, registry, overrides, options) {
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
            // Skip intermediate variable references (they show up in steps but not shopping list)
            if (item.type === 'reference')
                return;
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
                let declParentQty = 1; // Default to 1 if not specified
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
            const rawState = item.state || 'default';
            // Use canonical state for aggregation so "boite" and "conserve" merge
            const canonicalState = (0, i18n_1.resolveState)(rawState);
            const key = `${id}::${canonicalState}`;
            if (!listMap.has(key)) {
                let name = registry.ingredients.get(id)?.name || item.name;
                // Display the canonical state for consistency, OR user input?
                // Let's display User Input (rawState) for the first item encountered, 
                // OR display Canonical if it differs from default.
                // Issue: If we merge "boite" and "conserve", the label will be whichever came first.
                // Explicit request "keep possibility to add language".
                // Maybe standardized display is better? E.g. always "Mushroom (conserve)"? 
                // But we don't have the reverse map.
                // Let's allow the raw state to be part of the name if it's not default.
                if (canonicalState !== 'default') {
                    // Use the canonical state in the label? "Mushroom (canned)" -> might be English.
                    // Use the RAW state? "Mushroom (boîte)".
                    // User preference: likely wants to see what they typed, or a localized version.
                    // Since we assume the aliases map TO English keys (usually), showing the raw input is safer for I18N context
                    // UNLESS the user wrote in English and wants French.
                    // Let's stick to: Use rawState for display if it's the first one.
                    name = `${name} (${rawState})`;
                }
                listMap.set(key, {
                    id: id,
                    name: name,
                    state: rawState, // Keep raw state in the object for info
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
                    else if (qObj.type === 'single') {
                        numericQty = qObj.value !== null ? qObj.value : 0;
                    }
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
                const unitForCalc = unit || 'unit';
                const norm = (0, mass_normalization_1.normalizeMass)(numericQty, unitForCalc, existing.name, overrides, options);
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
                existing.variableParts.push("⚠️ Circular Ref.");
            }
        });
    });
    const standardList = [...listMap.values()].map(item => {
        const res = {
            id: item.id,
            name: item.name,
            state: item.state
        };
        if (options?.enableMassNormalization !== false) {
            res.normalizedMass = item.normalizedMass;
            res.isEstimate = item.isEstimate;
            res.conversionMethod = item.isEstimate ? 'estimate' : 'physical';
        }
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
        if (options?.enableYieldManagement !== false && res.normalizedMass && res.normalizedMass > 0) {
            const dbData = (0, ingredient_db_1.getIngredientData)(item.id);
            if (dbData && dbData.physical && dbData.physical.yield && dbData.physical.yield < 1) {
                const gross = res.normalizedMass / dbData.physical.yield;
                res.purchasingMass = parseFloat(gross.toFixed(2));
            }
        }
        const hasMass = item.sureMass > 0;
        const hasOther = Object.keys(item.otherUnits).length > 0;
        const extraEntries = [];
        if (hasMass) {
            for (const [u, q] of Object.entries(item.otherUnits)) {
                const uStr = u ? ` ${u}` : '';
                extraEntries.push(`${parseFloat(q.toFixed(2))}${uStr}`);
            }
        }
        else if (hasOther) {
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
    // --- Aggregation: Merge Direct Usage into Composite ---
    const finalStandardList = [];
    standardList.forEach(stdItem => {
        if (compositeMap.has(stdItem.id)) {
            const comp = compositeMap.get(stdItem.id);
            let addQty = 0;
            if (stdItem.qty) {
                addQty = stdItem.qty;
            }
            const directUsageKey = `__direct_${stdItem.id}`;
            comp._usageAccumulator.set(directUsageKey, {
                id: stdItem.id,
                alias: 'Direct Use',
                qty: stdItem.qty,
                unit: stdItem.unit
            });
            comp._directAddQty = addQty;
        }
        else {
            finalStandardList.push(stdItem);
        }
    });
    const compositeList = [...compositeMap.values()].map(c => {
        let maxQ = 0;
        for (const q of c._subUsageMap.values()) {
            if (q > maxQ)
                maxQ = q;
        }
        if (c._directAddQty) {
            maxQ += c._directAddQty;
        }
        c.qty = maxQ;
        const parentName = registry.ingredients.get(c.id)?.name || c.id;
        const parentNorm = (0, mass_normalization_1.normalizeMass)(c.qty, 'unit', parentName, overrides, options);
        let cRes = {
            type: 'composite',
            id: c.id,
            name: parentName,
            qty: c.qty,
            usage: []
        };
        if (parentNorm) {
            cRes.normalizedMass = parentNorm.mass;
            cRes.isEstimate = parentNorm.isEstimate;
            cRes.conversionMethod = parentNorm.method;
        }
        cRes.usage = [...c._usageAccumulator.values()].map(u => {
            const childUsage = { ...u };
            if (u.qty && typeof u.qty === 'number') {
                const childId = u.id || '';
                const childName = registry.ingredients.get(childId)?.name || childId;
                const childNorm = (0, mass_normalization_1.normalizeMass)(u.qty, u.unit || '', childName, overrides, options);
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
        ...finalStandardList,
        ...compositeList,
        ...alternatives
    ];
}

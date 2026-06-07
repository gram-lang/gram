"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateShoppingList = generateShoppingList;
const utils_1 = require("./utils");
const graph_1 = require("./graph");
/**
 * Format raw quantity AST nodes (fractions, ranges, variables, relative quantities)
 * into human-readable strings for display in the shopping list.
 */
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
    if (q.type === 'RelativeQuantity') {
        const marker = q.referenceType === 'variable' ? '&' : '@';
        return `${q.percent}% of ${marker}${q.target}`;
    }
    return JSON.stringify(q);
}
/**
 * Main entry point for shopping list generation.
 * Iterates through all compiled sections and merges identical ingredients by ID,
 * aggregates compatible quantities, handles composite/parent sub-recipes, and flags circular references.
 */
function generateShoppingList(sections, registry, options) {
    const listMap = new Map();
    const compositeMap = new Map();
    const alternatives = [];
    // Detect circular dependencies globally
    const circularIds = (0, graph_1.detectCycles)(sections);
    sections.forEach(sec => {
        sec.ingredients.forEach(item => {
            // 1. Separate alternatives to be rendered separately at the end
            if (item.type === 'alternative') {
                alternatives.push(item);
                return;
            }
            if (circularIds.has(item.id)) {
                item.isCircular = true;
            }
            // Skip pure variable references (they don't go onto a grocery list)
            if (item.type === 'reference')
                return;
            // 2. Handle composite sub-recipe ingredients
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
                // Accumulate declared parent batch requirements (default to 1)
                let declParentQty = 1;
                if (item.composite && item.composite.quantity) {
                    const minQ = (0, utils_1.minifyQuantity)(item.composite.quantity);
                    if (typeof minQ === 'number')
                        declParentQty = minQ;
                }
                const subId = item.id;
                const currentParentTotal = comp._subUsageMap.get(subId) || 0;
                comp._subUsageMap.set(subId, currentParentTotal + declParentQty);
                // Accumulate child quantities inside the sub-recipe
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
            // 3. Normal ingredient aggregation
            const id = item.id;
            const key = id; // Group simply by ID
            if (!listMap.has(key)) {
                let name = registry.ingredients.get(id)?.name || item.name;
                listMap.set(key, {
                    id: id,
                    name: name,
                    otherUnits: {},
                    variableParts: [],
                });
            }
            const existing = listMap.get(key);
            // Extract numeric quantities if resolvable
            let numericQty = null;
            let unit = item.unit || '';
            let isGhost = false;
            if (item.formula) {
                if (item.formula.isGhost) {
                    isGhost = true;
                }
                else {
                    if (typeof item.qty === 'number') {
                        numericQty = item.qty;
                    }
                }
            }
            else {
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
            // Push ghosts, variables, and circular warnings to alternative descriptions
            if (isGhost) {
                let text = item.formula ? item.formula.raw : (item.qty && item.qty.value) || '';
                if (item.formula) {
                    text = item.formula.raw;
                }
                const display = `${text} ❓`;
                existing.variableParts.push(`(${display})`);
            }
            else if (numericQty !== null) {
                // Sum numeric quantities under matching units
                const u = unit;
                if (!existing.otherUnits[u])
                    existing.otherUnits[u] = 0;
                existing.otherUnits[u] += numericQty;
            }
            else {
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
    // 4. Transform and round aggregated items into a clean standard shopping list schema
    const standardList = [...listMap.values()].map(item => {
        const res = {
            id: item.id,
            name: item.name
        };
        const units = Object.keys(item.otherUnits);
        if (units.length > 0) {
            res.qty = parseFloat(item.otherUnits[units[0]].toFixed(2));
            res.unit = units[0] || null;
        }
        const hasOther = Object.keys(item.otherUnits).length > 0;
        const extraEntries = [];
        if (hasOther) {
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
    // 5. Merge direct ingredient usages into their composite parent sub-recipes
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
    // 6. Finalize composite parent sub-recipe item listings
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
        let cRes = {
            type: 'composite',
            id: c.id,
            name: parentName,
            qty: c.qty,
            usage: []
        };
        cRes.usage = [...c._usageAccumulator.values()].map(u => {
            const childUsage = { ...u };
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

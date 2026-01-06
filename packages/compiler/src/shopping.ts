import { slugify, minifyQuantity } from './utils';
import { normalizeMass } from './mass_normalization';
import { getIngredientData } from './ingredient_db';
import { detectCycles } from './graph';
import { ProcessedSection, Registry, Usage, QuantityValueAST } from 'gram-parser';

interface ShoppingListItem {
    id: string;
    name?: string;
    qty?: number;
    unit?: string | null;
    variable_entries?: string[];
    // Internal fields for calculation
    sureMass?: number;
    otherUnits?: Record<string, number>;
    variableParts?: string[];
    _hasSure?: boolean;
    // New fields
    normalizedMass?: number;
    isEstimate?: boolean;
    conversionMethod?: string;
    purchasingMass?: number; // Gross mass considering yield/waste
}

interface CompositeItem {
    type: 'composite';
    id: string;
    qty: number; // calculated max parent qty
    usage: Partial<Usage>[];
    _subUsageMap: Map<string, number>;
    _usageAccumulator: Map<string, Partial<Usage>>;
}

function formatQuantity(q: any): string | number {
    if (!q) return '';
    if (typeof q === 'number') return q;
    
    // Handle objects
    if (q.type === 'single') return q.value;
    if (q.type === 'range') return q.text || `${q.value}`;
    if (q.type === 'fraction') return q.text || `${q.value}`;
    
    return JSON.stringify(q);
}

export function generateShoppingList(sections: ProcessedSection[], registry: Registry, overrides?: Record<string, number>): (ShoppingListItem | CompositeItem | Usage)[] {
    const listMap = new Map<string, ShoppingListItem>();
    const compositeMap = new Map<string, CompositeItem>();
    const alternatives: Usage[] = [];

    const circularIds = detectCycles(sections);

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
                 const parentId = slugify(item.composite.parent);
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
                 const comp = compositeMap.get(parentId)!;
                 
                 // Accumulate Parent Quantity Requirement
                 let declParentQty = 0;
                 if (item.composite && item.composite.quantity) {
                      const minQ = minifyQuantity(item.composite.quantity);
                      if (typeof minQ === 'number') declParentQty = minQ;
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
                 const uEntry = comp._usageAccumulator.get(uKey)!;
                 
                 let childVal = 0;
                 if (typeof item.qty === 'number') {
                     childVal = item.qty;
                 } else if (item.qty && typeof item.qty === 'object') {
                     const m = minifyQuantity(item.qty);
                     if (typeof m === 'number') childVal = m;
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
            
            const existing = listMap.get(key)!;
            
            // LOGIC: Resolve Quantity to Number if possible
            let numericQty: number | null = null;
            let unit = item.unit || '';
            let isGhost = false;

            // Check if Relative
            if (item.formula) {
                if (item.formula.isGhost) {
                     isGhost = true;
                } else {
                     // Calculated relative
                     if (typeof item.qty === 'number') {
                         numericQty = item.qty;
                     }
                }
            } else {
                // Absolute
                if (typeof item.qty === 'number') {
                    numericQty = item.qty;
                } else if (item.qty && typeof item.qty === 'object') {
                    const qObj = item.qty as QuantityValueAST;
                    if (qObj.type === 'fraction') numericQty = qObj.value as number;
                    else if (qObj.type === 'range') numericQty = qObj.value as number; 
                    else if (qObj.type === 'single') numericQty = qObj.value as number;
                }
            }
            
            if (isGhost) {
                 // GHOST HANDLING
                 let text = item.formula ? item.formula.raw : (item.qty && (item.qty as any).value) || '';
                 if (item.formula) {
                     text = item.formula.raw;
                 }
                 const display = `${text} ❓`;
                 existing.variableParts!.push(`(${display})`);
            } else if (numericQty !== null) {
                // 1. Calculate Mass for Badge (Total Normalized)
                const norm = normalizeMass(numericQty, unit, existing.name, overrides);
                if (norm) {
                    existing.normalizedMass = (existing.normalizedMass || 0) + norm.mass;
                    if (norm.isEstimate) existing.isEstimate = true;
                }

                // 2. Aggregation Logic for Display (Physical vs Other)
                if (norm && norm.method === 'physical') {
                    existing.sureMass! += norm.mass;
                    existing._hasSure = true;
                } else {
                    const u = unit;
                    if (!existing.otherUnits![u]) existing.otherUnits![u] = 0;
                    existing.otherUnits![u] += numericQty;
                }
            } else {
                 // Unresolved or Just Variable
                 if (item.qty) {
                      const qStr = formatQuantity(item.qty);
                      const uStr = unit ? ` ${unit}` : '';
                      existing.variableParts!.push(`${qStr}${uStr}`);
                 }
            }
            
            if (!isGhost && item.isCircular) {
                 existing.variableParts!.push("⚠️ Ref. Circulaire");
            }
        });
    });

    const standardList = [...listMap.values()].map(item => {
        const res: ShoppingListItem = {
            id: item.id,
            name: item.name,
            normalizedMass: item.normalizedMass,
            isEstimate: item.isEstimate,
            conversionMethod: item.isEstimate ? 'estimate' : 'physical'
        };

        // Determine main Qty/Unit
        if (item.sureMass! > 0) {
             res.qty = parseFloat(item.sureMass!.toFixed(2));
             res.unit = 'g';
        } else {
             const units = Object.keys(item.otherUnits!);
             if (units.length > 0) {
                  res.qty = parseFloat(item.otherUnits![units[0]].toFixed(2));
                  res.unit = units[0] || null;
             }
        }

        // --- Gross Mass Calculation (Yield) ---
        // Only if we have a normalized mass (Net) and the ingredient has a yield factor < 1
        if (res.normalizedMass && res.normalizedMass > 0) {
             const dbData = getIngredientData(item.id);
             if (dbData && dbData.yield && dbData.yield < 1) {
                 const gross = res.normalizedMass / dbData.yield;
                 res.purchasingMass = parseFloat(gross.toFixed(2));
             }
        }
        
        const hasMass = item.sureMass! > 0;
        const hasOther = Object.keys(item.otherUnits!).length > 0;
        
        const extraEntries: string[] = [];
        
        if (hasMass) {
             // Mass is in Qty. Any other units are extra.
             for (const [u, q] of Object.entries(item.otherUnits!)) {
                  const uStr = u ? ` ${u}` : '';
                  extraEntries.push(`${parseFloat(q.toFixed(2))}${uStr}`);
             }
        } else if (hasOther) {
             // First unit is in Qty. Others are extra.
             const units = Object.keys(item.otherUnits!);
             for (let i = 1; i < units.length; i++) {
                  const u = units[i];
                  const uStr = u ? ` ${u}` : '';
                  extraEntries.push(`${parseFloat(item.otherUnits![u].toFixed(2))}${uStr}`);
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
            if (q > maxQ) maxQ = q;
        }
        c.qty = maxQ;

        // Calculate Mass for Parent Composite
        // Composite parents are almost always counted units (e.g. 6 eggs)
        // If an explicit unit exists in composite definition we should use it, but here we infer 'unit' from maxQ usually being unitless count
        const parentName = registry.ingredients.get(c.id)?.name || c.id;
        const parentNorm = normalizeMass(c.qty, 'unit', parentName, overrides);
        
        let cRes: any = {
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
            const childUsage: any = { ...u };
            if (u.qty && typeof u.qty === 'number') {
                const childId = u.id || '';
                const childName = registry.ingredients.get(childId)?.name || childId;
                const childNorm = normalizeMass(u.qty, u.unit || '', childName, overrides);
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

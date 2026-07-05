import { slugify, minifyQuantity, getNumericQty } from './utils';
import { detectCycles } from './graph';
import { QuantityValueAST, ASTNodeType } from '@gram/parser';
import { ProcessedSection, Registry, Usage } from './types';
import { CompilerOptions } from './core';

interface ShoppingListItem {
    id: string;
    name?: string;
    qty?: number;
    unit?: string | null;
    variable_entries?: string[];
    fixed?: boolean;
    relative?: boolean;
    multiUnit?: boolean;
    modifiers?: string[];
    // Internal fields for calculation
    otherUnits?: Record<string, number>;
    variableParts?: string[];
    _usageIds?: string[];
    allFixed?: boolean;
    isRelative?: boolean;
    modifierSet?: Set<string>;
}

interface CompositeItem {
    type: 'composite';
    id: string;
    qty: number; // calculated max parent qty
    usage: Partial<Usage>[];
    _subUsageMap: Map<string, number>;
    _usageAccumulator: Map<string, Partial<Usage>>;
}

/**
 * Format raw quantity AST nodes (fractions, ranges, variables, relative quantities)
 * into human-readable strings for display in the shopping list.
 */
function formatQuantity(q: any): string | number {
    if (!q) return '';
    if (typeof q === 'number') return q;
    
    // Handle objects
    if (q.type === 'single') return q.value;
    if (q.type === 'range') return q.text || `${q.value}`;
    if (q.type === 'fraction') return q.text || `${q.value}`;
    if (q.type === ASTNodeType.RelativeQuantity) {
        return `${q.percent}% of ${q.target}`;
    }
    
    return JSON.stringify(q);
}

/**
 * Main entry point for shopping list generation.
 * Iterates through all compiled sections and merges identical ingredients by ID,
 * aggregates compatible quantities, handles composite/parent sub-recipes, and flags circular references.
 */
export function generateShoppingList(sections: ProcessedSection[], registry: Registry, options?: CompilerOptions): (ShoppingListItem | CompositeItem | Usage)[] {
    const listMap = new Map<string, ShoppingListItem>();
    const compositeMap = new Map<string, CompositeItem>();
    const alternatives: Usage[] = [];

    // Detect circular dependencies globally
    const circularIds = detectCycles(sections);

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
            if (item.type === 'reference') return;

            // 2. Handle composite sub-recipe ingredients
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
                 
                 // Accumulate declared parent batch requirements (default to 1)
                 let declParentQty = 1;
                 if (item.composite && item.composite.quantity) {
                      const numQ = getNumericQty(item.composite.quantity);
                      if (numQ !== null) declParentQty = numQ;
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
                 const uEntry = comp._usageAccumulator.get(uKey)!;
                 
                 let childVal = 0;
                 const numQ = getNumericQty(item.qty);
                 if (numQ !== null) {
                     childVal = numQ;
                 }
                 
                 if (typeof uEntry.qty === 'number') {
                     uEntry.qty += childVal;
                 }
                 return;
            }

            // 3. Normal ingredient aggregation
            const id = item.id;
            
            // Extract numeric quantities if resolvable
            let numericQty: number | null = null;
            let unit = item.unit || '';
            let isGhost = false;

            if (item.formula) {
                if (item.formula.isGhost) {
                     isGhost = true;
                } else {
                     const numQ = getNumericQty(item.qty);
                     if (numQ !== null) numericQty = numQ;
                }
            } else {
                const numQ = getNumericQty(item.qty);
                if (numQ !== null) numericQty = numQ;
            }

            // Group by ID AND unit (and ghost status) to prevent semantic data loss 
            // where secondary units were stringified into variable_entries.
            const key = `${id}::${unit}::${isGhost ? 'ghost' : 'real'}`;

            if (!listMap.has(key)) {
                let name = registry.ingredients.get(id)?.name || item.name;
                
                listMap.set(key, {
                    id: id,
                    name: name,
                    unit: unit,
                    otherUnits: {},
                    variableParts: [],
                    _usageIds: [],
                });
            }
            
            const existing = listMap.get(key)!;
            if (item._usageId) {
                existing._usageIds!.push(item._usageId);
            }

            // Track whether every contributing usage is protected (@= or a
            // TextQuantity like "a pinch"), and whether any is a relative
            // (formula-derived) quantity — both disqualify this ingredient
            // as a --scale reference target (see @gram/kitchen's ScaleEngine).
            existing.allFixed = item.fixed ? (existing.allFixed ?? true) : false;
            if (item.formula) existing.isRelative = true;
            // Propagate modifiers (e.g. the `*` baker's-percentage reference marker)
            // so consumers reading the shopping list — not just per-usage AST nodes —
            // can find it too.
            if (item.modifiers && item.modifiers.length > 0) {
                if (!existing.modifierSet) existing.modifierSet = new Set();
                item.modifiers.forEach((m: string) => existing.modifierSet!.add(m));
            }

            // (Numeric extraction moved up above key generation)
            
            // Push ghosts, variables, and circular warnings to alternative descriptions
            if (isGhost) {
                 let text = item.formula ? item.formula.raw : (item.qty && (item.qty as any).value) || '';
                 if (item.formula) {
                     text = item.formula.raw;
                 }
                 const display = `${text} ❓`;
                 existing.variableParts!.push(`(${display})`);
            } else if (numericQty !== null) {
                 // Sum numeric quantities under matching units
                 const u = unit;
                 if (!existing.otherUnits![u]) existing.otherUnits![u] = 0;
                 existing.otherUnits![u] += numericQty;
            } else {
                 if (item.qty) {
                      const qStr = formatQuantity(item.qty);
                      const uStr = unit ? ` ${unit}` : '';
                      existing.variableParts!.push(`${qStr}${uStr}`);
                 }
            }
            
            if (!isGhost && item.isCircular) {
                 existing.variableParts!.push("⚠️ Circular Ref.");
            }
        });
    });

    // 4. Transform and round aggregated items into a clean standard shopping list schema
    const standardList = [...listMap.values()].map(item => {
        const res: ShoppingListItem = {
            id: item.id,
            name: item.name
        };
        if (item._usageIds && item._usageIds.length > 0) {
            res._usageIds = item._usageIds;
        }
        if (item.allFixed) res.fixed = true;
        if (item.isRelative) res.relative = true;
        if (item.modifierSet && item.modifierSet.size > 0) res.modifiers = [...item.modifierSet];

        const units = Object.keys(item.otherUnits!);
        const primaryUnit = units[0];
        if (primaryUnit !== undefined) {
            res.qty = parseFloat((item.otherUnits![primaryUnit] || 0).toFixed(2));
            res.unit = primaryUnit || null;
        }
        if (units.length > 1) res.multiUnit = true;

        const hasOther = Object.keys(item.otherUnits!).length > 0;
        
        const extraEntries: string[] = [];
        if (hasOther) {
             const units = Object.keys(item.otherUnits!);
             for (let i = 1; i < units.length; i++) {
                   const u = units[i];
                   if (u === undefined) continue;
                   const uStr = u ? ` ${u}` : '';
                   extraEntries.push(`${parseFloat((item.otherUnits![u] || 0).toFixed(2))}${uStr}`);
             }
        }
        
        const allVars = [...extraEntries, ...(item.variableParts || [])];
        if (allVars.length > 0) {
             res.variable_entries = allVars;
        }

        return res;
    });

    // 5. Merge direct ingredient usages into their composite parent sub-recipes
    const finalStandardList: ShoppingListItem[] = [];
    
    standardList.forEach(stdItem => {
         if (compositeMap.has(stdItem.id)) {
              const comp = compositeMap.get(stdItem.id)!;
              
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
              
              (comp as any)._directAddQty = addQty;
         } else {
              finalStandardList.push(stdItem);
         }
    });

    // 6. Finalize composite parent sub-recipe item listings
    const compositeList = [...compositeMap.values()].map(c => {
        let maxQ = 0;
        for (const q of c._subUsageMap.values()) {
            if (q > maxQ) maxQ = q;
        }
        
        if ((c as any)._directAddQty) {
            maxQ += (c as any)._directAddQty;
        }

        c.qty = maxQ;
        const parentName = registry.ingredients.get(c.id)?.name || c.id;
        
        let cRes: any = {
            type: 'composite',
            id: c.id,
            name: parentName,
            qty: c.qty,
            usage: [] 
        };

        cRes.usage = [...c._usageAccumulator.values()].map(u => {
            const childUsage: any = { ...u };
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

import { QuantityAST, RelativeQuantityAST, Usage, QuantityValueAST, TextQuantityAST } from 'gram-parser';

export const slugify = (text: string | number): string => {
    return text
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        || 'unknown';
};

export const minifyQuantity = (q: any): number | QuantityValueAST | undefined => {
    if (!q) return undefined;
    if (typeof q === 'number') return q;
    
    // Check for specific AST types or general structures
    if (q.type === 'single' && q.value !== undefined) return q.value;
    if (q.type === 'range' || q.type === 'fraction') return q;
    
    // If it's a full QuantityAST
    if (q.type === 'Quantity') {
        if (q.value && q.value.type === 'single') return q.value.value;
        return q.value; 
    }
    
    // Explicitly ignore RelativeQuantity for minification in this context
    if (q.type === 'RelativeQuantity') return undefined; 
    
    return q;
};

import { normalizeMass } from './mass_normalization';

export const createCleanUsage = (item: any, id: string, overrides?: Record<string, number>): Usage => {
    const obj: Usage = { id };
    const qtyNode = item.quantity;
    let cleanQty: any = undefined;
    
    if (qtyNode) {
        // If it's a TextQuantity, we use the value directly
        if (qtyNode.type === 'TextQuantity') {
             cleanQty = qtyNode.value;
        } else {
             cleanQty = minifyQuantity(qtyNode.value || qtyNode);
        }
    }
    
    if (cleanQty !== undefined) obj.qty = cleanQty;
    if (qtyNode && qtyNode.unit) obj.unit = qtyNode.unit;
    
    // Mass Normalization Integration
    let valForCalc: number | null = null;
    if (typeof obj.qty === 'number') valForCalc = obj.qty;
    else if (obj.qty && typeof obj.qty === 'object' && typeof (obj.qty as any).value === 'number') {
         valForCalc = (obj.qty as any).value; // Handles Range (avg) and Fraction
    }

    if (valForCalc !== null) {
         const unitForCalc = obj.unit || 'unit';
         // Use item.name directly for lookup, do not attach to obj
         const norm = normalizeMass(valForCalc, unitForCalc, item.name, overrides);
         if (norm) {
             obj.normalizedMass = norm.mass;
             obj.conversionMethod = norm.method;
             obj.isEstimate = norm.isEstimate;
         }
    }

    if (item.modifiers && item.modifiers.length > 0) {
        const MODIFIER_MAP: Record<string, string> = {
            '?': 'optional',
            '-': 'hidden',
            '&': 'reference',
            '*': 'bakers_percentage'
        };
        obj.modifiers = item.modifiers.map((m: string) => MODIFIER_MAP[m] || m);
    }

    if (item.type === 'Cookware') {
        if (qtyNode && qtyNode.fixed === false) obj.fixed = false;
    } else {
        if (qtyNode && qtyNode.fixed === true) obj.fixed = true;
    }
    
    // Special handling for TextQuantity override
    if (qtyNode && qtyNode.type === 'TextQuantity') {
        obj.qty = qtyNode.value;
        obj.fixed = true; 
    }

    if (item.alias) obj.alias = item.alias;
    if (item.preparation) obj.preparation = item.preparation;
    
    if (item.composite) {
         const comp: any = {};
         if (item.composite.parent) comp.parent = item.composite.parent;
         if (item.composite.quantity) {
             const compQty = item.composite.quantity;
             const minified = minifyQuantity(compQty);
             if (minified !== undefined) comp.quantity = minified;
             if (compQty.unit) comp.unit = compQty.unit;
         }
         obj.composite = comp;
    }

    return obj;
};

export const cleanObject = (obj: any): any => {
    if (obj === null || obj === undefined) return undefined;
    if (Array.isArray(obj)) {
        const cleanedArr = obj.map(cleanObject).filter(x => x !== undefined && x !== null);
        return cleanedArr;
    }
    if (typeof obj === 'object') {
        const res: any = {};
        for (const key in obj) {
            const val = obj[key];
            const cleanedVal = cleanObject(val);
            if (cleanedVal !== null && cleanedVal !== undefined) {
                 if (Array.isArray(cleanedVal) && cleanedVal.length === 0) continue;
                 res[key] = cleanedVal;
            }
        }
        return res;
    }
    return obj;
};

import { QuantityAST, RelativeQuantityAST, QuantityValueAST, TextQuantityAST, ASTNodeType } from '@gram/parser';
import { Usage } from './types';
import { resolveTimeUnit } from '@gram/i18n';
import { CompilerOptions } from './core';

/**
 * Normalizes user-inputted strings (like ingredient names) into URL-friendly, 
 * standard alphanumeric identifiers (slugs).
 * 
 * Used globally to generate robust keys/IDs (e.g., "basmati-rice" from "Basmati Rice")
 * to ensure reliable lookups and comparisons across ingredients and databases.
 */
export const slugify = (text: string | number): string => {
    return text
        .toString()
        .toLowerCase()
        .replace(/œ/g, 'oe')
        .replace(/æ/g, 'ae')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        || 'unknown';
};

/**
 * Simplifies complex parsed Quantity AST structures into compact JSON-friendly formats.
 * 
 * Extract raw numbers from simple single-value nodes, or preserve ranges and fractions 
 * as clean objects. Explicitly ignores RelativeQuantities since their evaluation is 
 * deferred to the analyzer.
 */
export const minifyQuantity = (q: any): number | QuantityValueAST | undefined => {
    if (!q) return undefined;
    if (typeof q === 'number') return q;
    
    // Check for specific AST types or general structures
    if (q.type === 'single' && q.value !== undefined) return q.value;
    if (q.type === 'range' || q.type === 'fraction') return q;
    
    // If it's a full QuantityAST
    if (q.type === ASTNodeType.Quantity) {
        if (q.value && q.value.type === 'single') return q.value.value;
        return q.value; 
    }
    
    // Explicitly ignore RelativeQuantity for minification in this context
    if (q.type === ASTNodeType.RelativeQuantity) return undefined; 
    
    return q;
};

/**
 * Standardizes a raw step/section ingredient or cookware item into a clean, unified `Usage` object.
 * 
 * Maps modifier symbols (?, -, &, *) to semantic names, handles fixed quantity states, 
 * extracts cleaned quantities/units, and retains metadata like parent composite scopes or custom aliases.
 */
export const createCleanUsage = (item: any, id: string, options?: CompilerOptions): Usage => {
    const obj: Usage = { id };
    const qtyNode = item.quantity;
    let cleanQty: any = undefined;
    
    if (qtyNode) {
        // If it's a TextQuantity, we use the value directly
        if (qtyNode.type === ASTNodeType.TextQuantity) {
             cleanQty = qtyNode.value;
        } else {
             cleanQty = minifyQuantity(qtyNode.value || qtyNode);
        }
    }
    
    if (cleanQty !== undefined) obj.qty = cleanQty;
    if (qtyNode && qtyNode.unit) obj.unit = qtyNode.unit;
    

    if (item.modifiers && item.modifiers.length > 0) {
        const MODIFIER_MAP: Record<string, string> = {
            '?': 'optional',
            '-': 'hidden',
            '&': 'reference',
            '*': 'bakers_percentage'
        };
        obj.modifiers = item.modifiers.map((m: string) => MODIFIER_MAP[m] || m);
    }

    if (item.type === ASTNodeType.Cookware) {
        if (qtyNode && qtyNode.fixed === false) obj.fixed = false;
    } else {
        if (qtyNode && qtyNode.fixed === true) obj.fixed = true;
    }
    
    // Special handling for TextQuantity override
    if (qtyNode && qtyNode.type === ASTNodeType.TextQuantity) {
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

/**
 * Recursively cleans a compiled output object by removing `null` and `undefined` properties.
 * 
 * Retains empty arrays for structural core fields (`ingredients`, `cookware`, `steps`, `sections`, etc.) 
 * to preserve a guaranteed API schema for consumers (avoiding undefined references), 
 * while stripping other empty arrays to keep the JSON output lightweight and neat.
 */
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
                 if (Array.isArray(cleanedVal) && cleanedVal.length === 0) {
                      const keepKeys = ['ingredients', 'cookware', 'steps', 'sections', 'shopping_list', 'warnings'];
                      if (!keepKeys.includes(key)) continue;
                 }
                 res[key] = cleanedVal;
            }
        }
        return res;
    }
    return obj;
};



/**
 * Converts a recipe time quantity AST (timer or active duration) into a unified number of minutes.
 * 
 * Supports ranges (takes the average), simple numbers, and fractions, and performs 
 * conversions from hours ('h') or seconds ('s') based on the resolved time unit.
 */
export const quantityToMinutes = (qty: any): number => {
    if (!qty) return 0;
    
    let val: number = 0;
    let unit: string = '';

    // Handle AST objects
    if (typeof qty === 'object') {
        if (qty.type === ASTNodeType.Quantity && qty.value) {
           const sub = qty.value;
           if (sub.type === 'single') val = sub.value as number;
           if (sub.type === 'fraction') val = sub.value as number;
           if (sub.type === 'range' && sub.range) val = (sub.range.min + sub.range.max) / 2;
           unit = qty.unit || '';
        } else if (qty.value !== undefined) {
             // Fallback for simple objects
             let raw = qty.value;
             if (typeof raw === 'object' && raw !== null) {
                 if (raw.type === 'single') raw = raw.value;
                 else if (raw.type === 'fraction') raw = raw.value;
                 else if (raw.type === 'range' && raw.range) raw = (raw.range.min + raw.range.max) / 2;
             }
             val = raw;
             unit = qty.unit || '';
         }
    } else {
        return 0; 
    }

    if (typeof val !== 'number') return 0;

    const u = resolveTimeUnit(unit);
    
    // Time conversions to minutes
    if (u === 'h') return val * 60;
    if (u === 'm') return val;
    if (u === 's') return val / 60;
    
    return val; 
};

/**
 * Multiplies a compiled quantity value by a scale factor.
 * Handles plain numbers, single/range/fraction QuantityValueAST objects.
 * String quantities (TextQuantity) and undefined values are left unchanged.
 */
export const scaleQty = (qty: any, factor: number): any => {
    if (factor === 1) return qty;
    if (typeof qty === 'number') return qty * factor;
    if (!qty || typeof qty !== 'object') return qty;

    if (qty.type === 'single' && typeof qty.value === 'number') {
        return { ...qty, value: qty.value * factor };
    }
    if (qty.type === 'range') {
        return {
            ...qty,
            value: typeof qty.value === 'number' ? qty.value * factor : qty.value,
            range: qty.range
                ? { min: qty.range.min * factor, max: qty.range.max * factor }
                : qty.range,
        };
    }
    if (qty.type === 'fraction' && typeof qty.value === 'number') {
        return { ...qty, value: qty.value * factor };
    }
    return qty;
};

/**
 * Post-processes a CompilationResult in-place, scaling all numeric ingredient quantities
 * by the given factor. Items marked as fixed (via the @= modifier or TextQuantity) are skipped.
 * Operates on: shopping_list, section ingredients, and step content tokens.
 */
export const applyScaleFactor = (result: any, factor: number): void => {
    if (factor === 1) return;

    const scaleUsage = (item: any) => {
        if (!item || typeof item !== 'object') return;
        if (item.fixed) return; // @= modifier or TextQuantity — never scaled
        if ('qty' in item && item.qty !== undefined) {
            item.qty = scaleQty(item.qty, factor);
        }
    };

    // Scale shopping list
    for (const item of result.shopping_list ?? []) {
        if (!item || typeof item !== 'object') continue;
        if (item.type === 'alternative') {
            for (const opt of item.options ?? []) scaleUsage(opt);
        } else if (item.type === 'composite') {
            if (typeof item.qty === 'number') item.qty = item.qty * factor;
            for (const u of item.usage ?? []) scaleUsage(u);
        } else {
            scaleUsage(item);
        }
    }

    // Scale section ingredients and step content tokens
    for (const section of result.sections ?? []) {
        for (const ing of section.ingredients ?? []) scaleUsage(ing);
        for (const stepItem of section.steps ?? []) {
            if (!stepItem || stepItem.type === 'comment') continue;
            for (const token of stepItem.content ?? []) {
                if (!token || typeof token !== 'object') continue;
                // Ingredient usage tokens have an 'id' and no token-type discriminator
                if ('id' in token && !('type' in token)) scaleUsage(token);
            }
        }
    }
};

export const getNumericQty = (q: any): number | null => {
    if (q === undefined || q === null) return null;
    if (typeof q === 'number') return q;
    
    const val = q.type === ASTNodeType.Quantity ? q.value : q;
    if (val && typeof val === 'object') {
        if (val.type === 'fraction' || val.type === 'range' || val.type === 'single') {
            return val.value !== null ? val.value : null;
        }
    } else if (typeof val === 'number') {
        return val;
    }
    return null;
};

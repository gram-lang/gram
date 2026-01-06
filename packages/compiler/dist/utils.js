"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanObject = exports.createCleanUsage = exports.minifyQuantity = exports.slugify = void 0;
const slugify = (text) => {
    return text
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        || 'unknown';
};
exports.slugify = slugify;
const minifyQuantity = (q) => {
    if (!q)
        return undefined;
    if (typeof q === 'number')
        return q;
    // Check for specific AST types or general structures
    if (q.type === 'single' && q.value !== undefined)
        return q.value;
    if (q.type === 'range' || q.type === 'fraction')
        return q;
    // If it's a full QuantityAST
    if (q.type === 'Quantity') {
        if (q.value && q.value.type === 'single')
            return q.value.value;
        return q.value;
    }
    // Explicitly ignore RelativeQuantity for minification in this context
    if (q.type === 'RelativeQuantity')
        return undefined;
    return q;
};
exports.minifyQuantity = minifyQuantity;
const mass_normalization_1 = require("./mass_normalization");
const createCleanUsage = (item, id, overrides) => {
    const obj = { id };
    const qtyNode = item.quantity;
    let cleanQty = undefined;
    if (qtyNode) {
        // If it's a TextQuantity, we use the value directly
        if (qtyNode.type === 'TextQuantity') {
            cleanQty = qtyNode.value;
        }
        else {
            cleanQty = (0, exports.minifyQuantity)(qtyNode.value || qtyNode);
        }
    }
    if (cleanQty !== undefined)
        obj.qty = cleanQty;
    if (qtyNode && qtyNode.unit)
        obj.unit = qtyNode.unit;
    // Mass Normalization Integration
    let valForCalc = null;
    if (typeof obj.qty === 'number')
        valForCalc = obj.qty;
    else if (obj.qty && typeof obj.qty === 'object' && typeof obj.qty.value === 'number') {
        valForCalc = obj.qty.value; // Handles Range (avg) and Fraction
    }
    if (valForCalc !== null) {
        const unitForCalc = obj.unit || 'unit';
        // Use item.name directly for lookup, do not attach to obj
        const norm = (0, mass_normalization_1.normalizeMass)(valForCalc, unitForCalc, item.name, overrides);
        if (norm) {
            obj.normalizedMass = norm.mass;
            obj.conversionMethod = norm.method;
            obj.isEstimate = norm.isEstimate;
        }
    }
    if (item.modifiers && item.modifiers.length > 0) {
        const MODIFIER_MAP = {
            '?': 'optional',
            '-': 'hidden',
            '&': 'reference',
            '*': 'bakers_percentage'
        };
        obj.modifiers = item.modifiers.map((m) => MODIFIER_MAP[m] || m);
    }
    if (item.type === 'Cookware') {
        if (qtyNode && qtyNode.fixed === false)
            obj.fixed = false;
    }
    else {
        if (qtyNode && qtyNode.fixed === true)
            obj.fixed = true;
    }
    // Special handling for TextQuantity override
    if (qtyNode && qtyNode.type === 'TextQuantity') {
        obj.qty = qtyNode.value;
        obj.fixed = true;
    }
    if (item.alias)
        obj.alias = item.alias;
    if (item.preparation)
        obj.preparation = item.preparation;
    if (item.composite) {
        const comp = {};
        if (item.composite.parent)
            comp.parent = item.composite.parent;
        if (item.composite.quantity) {
            const compQty = item.composite.quantity;
            const minified = (0, exports.minifyQuantity)(compQty);
            if (minified !== undefined)
                comp.quantity = minified;
            if (compQty.unit)
                comp.unit = compQty.unit;
        }
        obj.composite = comp;
    }
    return obj;
};
exports.createCleanUsage = createCleanUsage;
const cleanObject = (obj) => {
    if (obj === null || obj === undefined)
        return undefined;
    if (Array.isArray(obj)) {
        const cleanedArr = obj.map(exports.cleanObject).filter(x => x !== undefined && x !== null);
        return cleanedArr;
    }
    if (typeof obj === 'object') {
        const res = {};
        for (const key in obj) {
            const val = obj[key];
            const cleanedVal = (0, exports.cleanObject)(val);
            if (cleanedVal !== null && cleanedVal !== undefined) {
                if (Array.isArray(cleanedVal) && cleanedVal.length === 0)
                    continue;
                res[key] = cleanedVal;
            }
        }
        return res;
    }
    return obj;
};
exports.cleanObject = cleanObject;

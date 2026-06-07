"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quantityToMinutes = void 0;
const i18n_1 = require("./i18n");
const quantityToMinutes = (qty) => {
    if (!qty)
        return 0;
    let val = 0;
    let unit = '';
    // Handle AST objects
    if (typeof qty === 'object') {
        if (qty.type === 'Quantity' && qty.value) {
            const sub = qty.value;
            if (sub.type === 'single')
                val = sub.value;
            if (sub.type === 'fraction')
                val = sub.value;
            if (sub.type === 'range' && sub.range)
                val = (sub.range.min + sub.range.max) / 2;
            unit = qty.unit || '';
        }
        else if (qty.value !== undefined) {
            // Fallback for simple objects
            let raw = qty.value;
            if (typeof raw === 'object' && raw !== null) {
                if (raw.type === 'single')
                    raw = raw.value;
                else if (raw.type === 'fraction')
                    raw = raw.value;
                else if (raw.type === 'range' && raw.range)
                    raw = (raw.range.min + raw.range.max) / 2;
            }
            val = raw;
            unit = qty.unit || '';
        }
    }
    else {
        return 0;
    }
    if (typeof val !== 'number')
        return 0;
    const u = (0, i18n_1.resolveUnit)(unit);
    // Time conversions to minutes
    if (u === 'h' || u === 'hour' || u === 'hours')
        return val * 60;
    if (u === 'm' || u === 'min' || u === 'minute' || u === 'minutes' || u === 'mins')
        return val;
    if (u === 's' || u === 'sec' || u === 'second' || u === 'seconds')
        return val / 60;
    return val; // Assume minutes if unknown? Or 0? Let's assume minutes if no unit for timers usually, but safety says 0 or keep val. 
    // However, the parser enforces units for timers usually.
    // If unit is missing, it might be safer to return val (e.g. 10 -> 10m).
    return val;
};
exports.quantityToMinutes = quantityToMinutes;

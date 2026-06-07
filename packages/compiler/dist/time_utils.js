"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quantityToMinutes = void 0;
const TIME_ALIASES = {
    // Hours
    'h': 'h', 'hour': 'h', 'hours': 'h', 'heure': 'h', 'heures': 'h',
    // Minutes
    'm': 'm', 'min': 'm', 'mins': 'm', 'minute': 'm', 'minutes': 'm',
    // Seconds
    's': 's', 'sec': 's', 'secs': 's', 'second': 's', 'seconds': 's', 'seconde': 's', 'secondes': 's'
};
const resolveTimeUnit = (unit) => {
    if (!unit)
        return '';
    const clean = unit.trim().toLowerCase();
    return TIME_ALIASES[clean] || clean;
};
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
    const u = resolveTimeUnit(unit);
    // Time conversions to minutes
    if (u === 'h')
        return val * 60;
    if (u === 'm')
        return val;
    if (u === 's')
        return val / 60;
    return val;
};
exports.quantityToMinutes = quantityToMinutes;

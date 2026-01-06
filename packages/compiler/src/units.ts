export interface UnitMap {
    base: string;
    map: Record<string, number>;
}

export const UNIT_CONVERSIONS: Record<string, UnitMap> = {
    mass: { 
        base: 'g', 
        map: { 
            g: 1, gram: 1, grams: 1, gramme: 1, grammes: 1,
            kg: 1000, kilogram: 1000, kilograms: 1000,
            mg: 0.001, milligram: 0.001, milligrams: 0.001,
            oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
            lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592
        } 
    },
    volume: { 
        base: 'ml', 
        map: { 
            ml: 1, milliliter: 1, milliliters: 1,
            l: 1000, liter: 1000, liters: 1000, litre: 1000, litres: 1000,
            cl: 10, centiliter: 10,
            dl: 100, deciliter: 100,
            tsp: 4.9289, teaspoon: 4.9289, teaspoons: 4.9289,
            tbsp: 14.7868, tablespoon: 14.7868, tablespoons: 14.7868,
            cup: 236.588, cups: 236.588,
            pint: 473.176,
            quart: 946.353,
            gallon: 3785.41,
            'fl oz': 29.5735, 'fluid ounce': 29.5735
        } 
    }
};

export interface NormalizedUnit {
    quantity: number | any;
    unit: string | null;
}

export const normalizeUnit = (quantityObj: any, unit?: string | null): NormalizedUnit => {
    if (!quantityObj) return { quantity: 0, unit: unit || null };
    
    const u = (unit || '').toLowerCase().trim();
    
    let val = quantityObj;
    if (typeof quantityObj === 'object' && quantityObj.value !== undefined) {
        val = quantityObj.value;
    }
    
    if (typeof val !== 'number') return { quantity: quantityObj, unit: u };

    for (const { base, map } of Object.values(UNIT_CONVERSIONS)) {
        if (map[u]) {
            const newVal = val * map[u];
            return { quantity: newVal, unit: base };
        }
    }
    return { quantity: val, unit: u };
};

export interface MassResult {
    mass: number;
    valid: boolean;
}

export const getMass = (qty: any, unit?: string | null): MassResult => {
    let val = qty;
    
    // Resolve object if needed
    if (typeof qty === 'object' && qty !== null) {
        if (qty.type === 'fraction') val = qty.value;
        else if (qty.type === 'range') val = qty.value; // Average
        else if (qty.type === 'single') val = qty.value;
        else return { mass: 0, valid: false };
    }

    if (typeof val !== 'number') return { mass: 0, valid: false };
    
    const u = (unit || '').toLowerCase().trim();
    if (UNIT_CONVERSIONS.mass.map[u]) return { mass: val * UNIT_CONVERSIONS.mass.map[u], valid: true };
    if (UNIT_CONVERSIONS.volume.map[u]) return { mass: val * UNIT_CONVERSIONS.volume.map[u], valid: true }; // 1ml = 1g approximate
    return { mass: 0, valid: false };
};

export const quantityToMinutes = (qty: any): number => {
    if (!qty) return 0;
    
    let val: number = 0;
    let unit: string = '';

    // Handle AST objects
    if (typeof qty === 'object') {
        if (qty.type === 'Quantity' && qty.value) {
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

    const u = unit.toLowerCase().trim();
    
    // Time conversions to minutes
    if (u === 'h' || u === 'hour' || u === 'hours' || u === 'heure' || u === 'heures') return val * 60;
    if (u === 'm' || u === 'min' || u === 'minute' || u === 'minutes' || u === 'mins') return val;
    if (u === 's' || u === 'sec' || u === 'second' || u === 'seconds') return val / 60;
    
    return val; // Assume minutes if unknown? Or 0? Let's assume minutes if no unit for timers usually, but safety says 0 or keep val. 
                // However, the parser enforces units for timers usually.
                // If unit is missing, it might be safer to return val (e.g. 10 -> 10m).
    return val; 
};

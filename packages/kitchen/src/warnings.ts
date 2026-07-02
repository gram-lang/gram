export enum WarningCode {
    VARIABLE_NOT_FOUND = 'VARIABLE_NOT_FOUND',
    RELATIVE_QUANTITY_UNRESOLVED = 'RELATIVE_QUANTITY_UNRESOLVED',
    RELATIVE_QUANTITY_UNKNOWN_MASS = 'RELATIVE_QUANTITY_UNKNOWN_MASS',
    CIRCULAR_REFERENCE = 'CIRCULAR_REFERENCE',
    UNDEFINED_REFERENCE = 'UNDEFINED_REFERENCE',
    MISSING_UNIT = 'MISSING_UNIT',
    INVALID_UNIT = 'INVALID_UNIT',
    SCOPE_CONFLICT = 'SCOPE_CONFLICT',
    MISSING_INGREDIENT = 'MISSING_INGREDIENT',
    MISSING_MACROS = 'MISSING_MACROS',
    UNKNOWN_MASS = 'UNKNOWN_MASS',
    INVALID_MODIFIER_COMBINATION = 'INVALID_MODIFIER_COMBINATION'
}

export interface WarningPayloads {
    [WarningCode.VARIABLE_NOT_FOUND]: { targetName: string; item: string; loc?: any };
    [WarningCode.RELATIVE_QUANTITY_UNRESOLVED]: { targetName: string; item: string; loc?: any };
    [WarningCode.RELATIVE_QUANTITY_UNKNOWN_MASS]: { targetName: string; item: string; loc?: any };
    [WarningCode.CIRCULAR_REFERENCE]: { name: string; item: string; loc?: any };
    [WarningCode.UNDEFINED_REFERENCE]: { prefix: string; name: string; item: string; loc?: any };
    [WarningCode.MISSING_UNIT]: { type: 'Timer' | 'Temperature'; item: string; loc?: any };
    [WarningCode.INVALID_UNIT]: { value: string; loc?: any };
    [WarningCode.SCOPE_CONFLICT]: { varName: string; section: string | null; loc?: any };
    [WarningCode.MISSING_INGREDIENT]: { id: string };
    [WarningCode.MISSING_MACROS]: { id: string };
    [WarningCode.UNKNOWN_MASS]: { id: string };
    [WarningCode.INVALID_MODIFIER_COMBINATION]: { item: string; combination: string; loc?: any };
}

export const warningTemplates: { [K in WarningCode]: (payload: WarningPayloads[K]) => string } = {
    [WarningCode.VARIABLE_NOT_FOUND]: (p) => `Variable '&${p.targetName}' not found.`,
    [WarningCode.RELATIVE_QUANTITY_UNRESOLVED]: (p) => `Could not resolve relative quantity for '@${p.targetName}'. Source not found in current section.`,
    [WarningCode.RELATIVE_QUANTITY_UNKNOWN_MASS]: (p) => `Cannot compute relative quantity for '${p.item}' because the mass of target '${p.targetName}' is unknown.`,
    [WarningCode.CIRCULAR_REFERENCE]: (p) => `Circular reference detected: ${p.name} depends on itself.`,
    [WarningCode.UNDEFINED_REFERENCE]: (p) => `Reference to undefined ingredient '${p.prefix}${p.name}'.`,
    [WarningCode.MISSING_UNIT]: (p) => `${p.type} must have an explicit unit.`,
    [WarningCode.INVALID_UNIT]: (p) => `Invalid text content in Timer.`,
    [WarningCode.SCOPE_CONFLICT]: (p) => `Global variable '&${p.varName}' is redefined.`,
    [WarningCode.MISSING_INGREDIENT]: (p) => `"${p.id}" not found in database.`,
    [WarningCode.MISSING_MACROS]: (p) => `Ingredient "${p.id}" has no default macro data.`,
    [WarningCode.UNKNOWN_MASS]: (p) => `Cannot calculate mass for "${p.id}" to estimate nutrition.`,
    [WarningCode.INVALID_MODIFIER_COMBINATION]: (p) => `Invalid modifier combination on "${p.item}": ${p.combination}`
};

export function pushWarning<K extends WarningCode>(
    target: any[] | { warnings: any[] },
    code: K,
    payload: WarningPayloads[K]
): void {
    const message = warningTemplates[code](payload as any);
    const warnings = Array.isArray(target) ? target : target.warnings;
    
    if (Array.isArray(target) && (target.length === 0 || typeof target[0] === 'string')) {
        warnings.push(`${code}: ${message}`);
    } else {
        const warningObj: any = {
            code,
            message
        };
        if ('item' in payload) warningObj.item = (payload as any).item;
        if ('loc' in payload) warningObj.loc = (payload as any).loc;
        if ('section' in payload) warningObj.section = (payload as any).section;
        warnings.push(warningObj);
    }
}

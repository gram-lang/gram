import { ProcessedSection, Registry, Usage } from 'gram-parser';
interface ShoppingListItem {
    id: string;
    name?: string;
    qty?: number;
    unit?: string | null;
    variable_entries?: string[];
    sureMass?: number;
    otherUnits?: Record<string, number>;
    variableParts?: string[];
    _hasSure?: boolean;
    normalizedMass?: number;
    isEstimate?: boolean;
    conversionMethod?: string;
    purchasingMass?: number;
}
interface CompositeItem {
    type: 'composite';
    id: string;
    qty: number;
    usage: Partial<Usage>[];
    _subUsageMap: Map<string, number>;
    _usageAccumulator: Map<string, Partial<Usage>>;
}
export declare function generateShoppingList(sections: ProcessedSection[], registry: Registry, overrides?: Record<string, number>): (ShoppingListItem | CompositeItem | Usage)[];
export {};

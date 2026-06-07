import { ProcessedSection, Registry, Usage } from '@gram/parser';
import { CompilerOptions } from './core';
interface ShoppingListItem {
    id: string;
    name?: string;
    qty?: number;
    unit?: string | null;
    variable_entries?: string[];
    otherUnits?: Record<string, number>;
    variableParts?: string[];
}
interface CompositeItem {
    type: 'composite';
    id: string;
    qty: number;
    usage: Partial<Usage>[];
    _subUsageMap: Map<string, number>;
    _usageAccumulator: Map<string, Partial<Usage>>;
}
/**
 * Main entry point for shopping list generation.
 * Iterates through all compiled sections and merges identical ingredients by ID,
 * aggregates compatible quantities, handles composite/parent sub-recipes, and flags circular references.
 */
export declare function generateShoppingList(sections: ProcessedSection[], registry: Registry, options?: CompilerOptions): (ShoppingListItem | CompositeItem | Usage)[];
export {};

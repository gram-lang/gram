import type { IngredientData } from './types';
import { resolveCanonicalId } from './ingredient_db';

function isStandardItem(item: any): boolean {
    return !!item && item.type !== 'composite' && item.type !== 'alternative' && item.type !== 'group';
}

/**
 * Re-groups the shopping list produced by `@gram-lang/kitchen` (which groups purely by
 * raw id + unit, with no knowledge of the ingredient database) by CANONICAL id,
 * merging aliased ingredients (e.g. "beurre"/"butter") and cross-unit entries
 * (e.g. "100g" + "1 cup") into a single line whenever every contributing entry
 * already has a resolved `normalizedMass` (in grams).
 *
 * When a group can't be fully resolved to a mass (e.g. one entry has no density/
 * unit_weight available), the entries are left separate but renamed to the
 * canonical id/name and flagged `multiUnit: true`, so renderers can still group
 * them visually. Composite and alternative entries pass through untouched —
 * their own MAX/SUM and first-choice resolution rules are handled upstream by
 * `@gram-lang/kitchen`.
 */
export function aggregateShoppingList(shoppingList: any[], database: Record<string, IngredientData>): any[] {
    const passthrough: any[] = [];
    const standard: any[] = [];

    shoppingList.forEach(item => {
        (isStandardItem(item) ? standard : passthrough).push(item);
    });

    const order: string[] = [];
    const groups = new Map<string, any[]>();
    standard.forEach(item => {
        const canonicalId = resolveCanonicalId(item.name ?? item.id, database);
        if (!groups.has(canonicalId)) {
            groups.set(canonicalId, []);
            order.push(canonicalId);
        }
        groups.get(canonicalId)!.push(item);
    });

    const result: any[] = [];
    order.forEach(canonicalId => {
        const items = groups.get(canonicalId)!;
        const canonicalName = database[canonicalId]?.name;

        if (items.length === 1) {
            const only = items[0];
            only.id = canonicalId;
            if (canonicalName) only.name = canonicalName;
            result.push(only);
            return;
        }

        const allHaveMass = items.every(i => typeof i.normalizedMass === 'number');
        if (allHaveMass) {
            const totalMass = items.reduce((sum, i) => sum + i.normalizedMass, 0);
            const totalPurchasing = items.reduce((sum, i) => sum + (i.purchasingMass ?? i.normalizedMass), 0);

            const merged: any = {
                id: canonicalId,
                name: canonicalName ?? items[0].name,
                qty: parseFloat(totalMass.toFixed(2)),
                unit: 'g',
                normalizedMass: parseFloat(totalMass.toFixed(2)),
                isEstimate: items.some(i => i.isEstimate),
            };
            if (Math.abs(totalPurchasing - totalMass) > 0.001) {
                merged.purchasingMass = parseFloat(totalPurchasing.toFixed(2));
            }
            if (items.every(i => i.fixed)) merged.fixed = true;
            if (items.some(i => i.relative)) merged.relative = true;

            const usageIds = items.flatMap(i => i._usageIds ?? (i._usageId ? [i._usageId] : []));
            if (usageIds.length > 0) merged._usageIds = usageIds;

            const modifiers = new Set<string>();
            items.forEach(i => { (i.modifiers ?? []).forEach((m: string) => { modifiers.add(m); }); });
            if (modifiers.size > 0) merged.modifiers = [...modifiers];

            const variableEntries = items.flatMap(i => i.variable_entries ?? []);
            if (variableEntries.length > 0) merged.variable_entries = variableEntries;

            result.push(merged);
        } else {
            items.forEach(i => {
                i.id = canonicalId;
                if (canonicalName) i.name = canonicalName;
                i.multiUnit = true;
                result.push(i);
            });
        }
    });

    return [...result, ...passthrough];
}

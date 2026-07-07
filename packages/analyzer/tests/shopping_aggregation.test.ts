import { describe, it, expect } from 'bun:test';
import { aggregateShoppingList } from '../src/shopping_aggregation';
import type { IngredientData } from '../src/types';

const database: Record<string, IngredientData> = {
    butter: { name: 'Butter', aliases: ['beurre'], physical: { density: 0.911 } },
    flour: { name: 'Flour', physical: { density: 0.53 } },
};

describe('aggregateShoppingList', () => {
    it('leaves a single, unambiguous item untouched aside from canonical renaming', () => {
        const result = aggregateShoppingList(
            [{ id: 'butter', name: 'Butter', qty: 100, unit: 'g', normalizedMass: 100 }],
            database
        );
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ id: 'butter', name: 'Butter', qty: 100, unit: 'g' });
    });

    it('merges aliased ingredients sharing the same unit', () => {
        const result = aggregateShoppingList(
            [
                { id: 'butter', name: 'Butter', qty: 100, unit: 'g', normalizedMass: 100 },
                { id: 'beurre', name: 'Beurre', qty: 50, unit: 'g', normalizedMass: 50 },
            ],
            database
        );
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ id: 'butter', name: 'Butter', qty: 150, unit: 'g', normalizedMass: 150 });
    });

    it('merges cross-unit entries into grams when density resolved a mass for both', () => {
        const result = aggregateShoppingList(
            [
                { id: 'flour', name: 'Flour', qty: 100, unit: 'g', normalizedMass: 100 },
                { id: 'flour', name: 'Flour', qty: 1, unit: 'cup', normalizedMass: 125.28 },
            ],
            database
        );
        expect(result).toHaveLength(1);
        expect(result[0].unit).toBe('g');
        expect(result[0].qty).toBeCloseTo(225.28, 1);
        expect(result[0].multiUnit).toBeUndefined();
    });

    it('falls back to separate multiUnit-flagged entries when a mass is unresolved', () => {
        const result = aggregateShoppingList(
            [
                { id: 'flour', name: 'Flour', qty: 100, unit: 'g', normalizedMass: 100 },
                { id: 'flour', name: 'Flour', qty: 2, unit: 'cup' }, // no normalizedMass: density couldn't resolve it
            ],
            database
        );
        expect(result).toHaveLength(2);
        expect(result.every(r => r.multiUnit)).toBe(true);
        expect(result.every(r => r.id === 'flour' && r.name === 'Flour')).toBe(true);
    });

    it('leaves composite and alternative entries untouched', () => {
        const composite = { type: 'composite', id: 'lemon', name: 'Lemon', qty: 2, usage: [] };
        const alternative = { type: 'alternative', id: 'alternative', options: [] };
        const result = aggregateShoppingList([composite, alternative], database);
        expect(result).toEqual([composite, alternative]);
    });

    it('unions modifiers and usage ids, and ORs the isEstimate/relative flags across a merge', () => {
        const result = aggregateShoppingList(
            [
                { id: 'butter', name: 'Butter', qty: 100, unit: 'g', normalizedMass: 100, modifiers: ['bakers_percentage'], _usageIds: ['u1'], isEstimate: false },
                { id: 'beurre', name: 'Beurre', qty: 50, unit: 'g', normalizedMass: 50, modifiers: ['optional'], _usageIds: ['u2'], isEstimate: true, relative: true },
            ],
            database
        );
        // "optional" is an intersection, not a union: only one of the two
        // contributing entries is optional here (a required 100g + an
        // optional 50g), so the merged 150g line must NOT be marked optional
        // — it isn't fully skippable. Other modifiers still union normally.
        expect(result[0].modifiers).toEqual(['bakers_percentage']);
        expect(result[0]._usageIds).toEqual(['u1', 'u2']);
        expect(result[0].isEstimate).toBe(true);
        expect(result[0].relative).toBe(true);
    });

    it('keeps "optional" on a merge only when every contributing entry is optional', () => {
        const result = aggregateShoppingList(
            [
                { id: 'butter', name: 'Butter', qty: 100, unit: 'g', normalizedMass: 100, modifiers: ['optional'], _usageIds: ['u1'] },
                { id: 'beurre', name: 'Beurre', qty: 50, unit: 'g', normalizedMass: 50, modifiers: ['optional'], _usageIds: ['u2'] },
            ],
            database
        );
        expect(result[0].modifiers).toEqual(['optional']);
    });
});

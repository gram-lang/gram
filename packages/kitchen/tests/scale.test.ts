import { describe, it, expect } from 'bun:test';
import { getAST } from '@gram-lang/parser';
import { compile } from '../src/index';
import {
    resolveScaleFactor,
    applyScale,
    InvalidFactorError,
    IngredientNotFoundError,
    NestedOnlyTargetError,
    AlternativeTargetError,
    FixedIngredientError,
    RelativeTargetError,
    AmbiguousMultiUnitError,
    NonNumericTargetError,
    UnitMismatchError,
} from '../src/scale';
import type { CompilationResult } from '../src/types';

function compileRecipe(src: string): CompilationResult {
    return compile(getAST(src));
}

describe('resolveScaleFactor — factor mode', () => {
    it('accepts a positive finite factor', () => {
        expect(resolveScaleFactor(null, { type: 'factor', value: 2 })).toEqual({
            factor: 2,
            resolvedFrom: 'factor',
        });
    });

    it.each([0, -1, NaN, Infinity])('rejects non-positive/non-finite factor %p', (value) => {
        expect(() => resolveScaleFactor(null, { type: 'factor', value })).toThrow(InvalidFactorError);
    });
});

describe('resolveScaleFactor — target mode', () => {
    const recipe = compileRecipe(`
[Mix] Add @*flour{500g}, @water{70% @&flour}, @salt{10g}.
Add @flour{2 cups} for dusting.
Heat @=oil{50ml} in a pan.
Add @garnish{a pinch}.
Add @butter{100g}|@margarine{100g}.
Add @lemon zest{1}<@lemon.
Add @lemon juice{100ml}<@lemon{2}.
`);

    it('computes a factor from a simple numeric ingredient', () => {
        const res = resolveScaleFactor(recipe, { type: 'target', id: 'salt', qty: 20, unit: 'g' });
        expect(res.factor).toBe(2);
        expect(res.resolvedFrom).toBe('target');
        expect(res.targetId).toBe('salt');
    });

    it('slugifies the requested id before lookup (case/spacing tolerant)', () => {
        const res = resolveScaleFactor(recipe, { type: 'target', id: 'Salt', qty: 20, unit: 'g' });
        expect(res.factor).toBe(2);
    });

    it('converts compatible units via the injected convertUnit', () => {
        const convertUnit = (value: number, from: string, to: string) => {
            if (from === 'kg' && to === 'g') return value * 1000;
            return null;
        };
        const res = resolveScaleFactor(recipe, { type: 'target', id: 'salt', qty: 0.02, unit: 'kg' }, convertUnit);
        expect(res.factor).toBe(2);
        expect(res.unitConverted).toBe(true);
    });

    it('throws UnitMismatchError when units differ and no converter is given', () => {
        expect(() => resolveScaleFactor(recipe, { type: 'target', id: 'salt', qty: 0.02, unit: 'kg' })).toThrow(UnitMismatchError);
    });

    it('throws UnitMismatchError across incompatible physical families when the converter has no density to bridge with', () => {
        const convertUnit = () => null; // e.g. no density available for this ingredient
        expect(() => resolveScaleFactor(recipe, { type: 'target', id: 'salt', qty: 1, unit: 'ml' }, convertUnit)).toThrow(UnitMismatchError);
    });

    it('bridges mass <-> volume when the injected converter resolves a density — the engine itself has no notion of density', () => {
        // Simulates what a density-aware converter (e.g. @gram-lang/analyzer's convertUnit
        // bound to an ingredient's density) would return: 12g of salt at a fictional
        // density of 1.2 g/mL is 10mL, matching the recipe's 10g.
        const convertUnit = (value: number, from: string, to: string) => {
            if (from === 'ml' && to === 'g') return value * 1.2;
            return null;
        };
        const res = resolveScaleFactor(recipe, { type: 'target', id: 'salt', qty: 10, unit: 'ml' }, convertUnit);
        expect(res.factor).toBe(1.2);
        expect(res.unitConverted).toBe(true);
    });

    it('throws IngredientNotFoundError for an unknown id, listing available ids', () => {
        try {
            resolveScaleFactor(recipe, { type: 'target', id: 'sugar', qty: 10, unit: 'g' });
            expect.unreachable();
        } catch (err) {
            expect(err).toBeInstanceOf(IngredientNotFoundError);
            expect((err as IngredientNotFoundError).availableIds).toContain('salt');
            expect((err as IngredientNotFoundError).availableIds).toContain('lemon'); // composite parent is now a valid target
            expect((err as IngredientNotFoundError).availableIds).not.toContain('lemon-zest'); // nested-only child is not
        }
    });

    it('throws FixedIngredientError for an @= protected ingredient', () => {
        try {
            resolveScaleFactor(recipe, { type: 'target', id: 'oil', qty: 100, unit: 'ml' });
            expect.unreachable();
        } catch (err) {
            expect(err).toBeInstanceOf(FixedIngredientError);
            expect((err as FixedIngredientError).reason).toBe('protected');
        }
    });

    it('throws NonNumericTargetError for a quantity-less/text ingredient (e.g. "a pinch")', () => {
        expect(() => resolveScaleFactor(recipe, { type: 'target', id: 'garnish', qty: 1, unit: null })).toThrow(NonNumericTargetError);
    });

    it('throws RelativeTargetError for a formula-derived ingredient', () => {
        expect(() => resolveScaleFactor(recipe, { type: 'target', id: 'water', qty: 300, unit: 'g' })).toThrow(RelativeTargetError);
    });

    it('throws AmbiguousMultiUnitError when the ingredient is split across incompatible units', () => {
        expect(() => resolveScaleFactor(recipe, { type: 'target', id: 'flour', qty: 1, unit: 'kg' })).toThrow(AmbiguousMultiUnitError);
    });

    it('computes a factor from a composite (sub-recipe) parent total', () => {
        // "lemon" needs 2 total (max of zest:1, juice-cost:2) — a well-defined
        // absolute quantity, same as any other aggregated ingredient.
        const res = resolveScaleFactor(recipe, { type: 'target', id: 'lemon', qty: 6, unit: null });
        expect(res.factor).toBe(3);
    });

    it('throws NestedOnlyTargetError for an ingredient only used inside a composite, and its suggested fix (scale the parent) actually works', () => {
        let parentId: string | undefined;
        try {
            resolveScaleFactor(recipe, { type: 'target', id: 'lemon-zest', qty: 3, unit: null });
            expect.unreachable();
        } catch (err) {
            expect(err).toBeInstanceOf(NestedOnlyTargetError);
            parentId = (err as NestedOnlyTargetError).parentId;
            expect(parentId).toBe('lemon');
        }
        expect(() => resolveScaleFactor(recipe, { type: 'target', id: parentId!, qty: 6, unit: null })).not.toThrow();
    });

    it('throws AlternativeTargetError for an ingredient inside an alternative group', () => {
        try {
            resolveScaleFactor(recipe, { type: 'target', id: 'butter', qty: 200, unit: 'g' });
            expect.unreachable();
        } catch (err) {
            expect(err).toBeInstanceOf(AlternativeTargetError);
            expect((err as AlternativeTargetError).siblingIds).toEqual(['margarine']);
        }
    });

    it('throws InvalidFactorError for a zero-quantity reference ingredient', () => {
        const zeroRecipe = compileRecipe(`Add @salt{0g}.`);
        expect(() => resolveScaleFactor(zeroRecipe, { type: 'target', id: 'salt', qty: 10, unit: 'g' })).toThrow(InvalidFactorError);
    });

    it('throws InvalidFactorError for a non-positive requested target quantity', () => {
        expect(() => resolveScaleFactor(recipe, { type: 'target', id: 'salt', qty: -5, unit: 'g' })).toThrow(InvalidFactorError);
    });
});

describe('applyScale', () => {
    const recipe = compileRecipe(`---
portions: 2
---
[Mix] Add @flour{500g} and @salt{10g}.
Heat @=oil{50ml} in a pan.
`);

    it('is pure: never mutates the original CompilationResult', () => {
        const snapshot = JSON.parse(JSON.stringify(recipe));
        applyScale(recipe, 2);
        expect(recipe).toEqual(snapshot);
    });

    it('scales quantities, skips fixed ingredients, and updates portions + scaleFactor', () => {
        const scaled: any = applyScale(recipe, 2);
        const flour = scaled.shopping_list.find((i: any) => i.id === 'flour');
        const oil = scaled.shopping_list.find((i: any) => i.id === 'oil');
        expect(flour.qty).toBe(1000);
        expect(oil.qty).toBe(50); // fixed, unchanged
        expect(scaled.meta.portions).toBe('4'); // frontmatter values parse as strings
        expect(scaled.scaleFactor).toBe(2);
    });

    it('returns the same reference for a factor of 1 (no-op)', () => {
        expect(applyScale(recipe, 1)).toBe(recipe);
    });

    it('re-applying a different factor always starts from the same original (no compounding)', () => {
        const scaledA: any = applyScale(recipe, 2);
        const scaledB: any = applyScale(recipe, 3);
        const flourA = scaledA.shopping_list.find((i: any) => i.id === 'flour');
        const flourB = scaledB.shopping_list.find((i: any) => i.id === 'flour');
        expect(flourA.qty).toBe(1000);
        expect(flourB.qty).toBe(1500);
    });
});

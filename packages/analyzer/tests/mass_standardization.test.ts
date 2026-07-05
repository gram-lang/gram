import { describe, it, expect } from 'bun:test';
import {
    convertUnit,
    resolveIngredientDensity,
    parseDensityOverrides,
    standardizeMass,
    applyYield,
} from '../src/mass_standardization';
import type { IngredientData } from '../src/types';

const database: Record<string, IngredientData> = {
    honey: { name: 'Honey', physical: { density: 1.42 } },
};

describe('convertUnit', () => {
    it('converts within the same mass family without a density', () => {
        expect(convertUnit(1, 'kg', 'g')).toBe(1000);
    });

    it('converts within the same volume family without a density', () => {
        expect(convertUnit(1, 'l', 'ml')).toBe(1000);
    });

    it('returns the same value for equivalent unit aliases', () => {
        expect(convertUnit(500, 'gram', 'g')).toBe(500);
    });

    it('returns null crossing families without a density', () => {
        expect(convertUnit(150, 'g', 'ml')).toBeNull();
        expect(convertUnit(150, 'ml', 'g')).toBeNull();
    });

    it('bridges mass -> volume given a density (g/mL)', () => {
        // 150g of water (density 1) = 150ml
        expect(convertUnit(150, 'g', 'ml', 1)).toBe(150);
    });

    it('bridges volume -> mass given a density (g/mL)', () => {
        // 100ml of honey (density 1.42) = 142g
        expect(convertUnit(100, 'ml', 'g', 1.42)).toBeCloseTo(142, 5);
    });

    it('round-trips mass -> volume -> mass for a non-trivial density', () => {
        const ml = convertUnit(200, 'g', 'ml', 1.42)!;
        const backToGrams = convertUnit(ml, 'ml', 'g', 1.42)!;
        expect(backToGrams).toBeCloseTo(200, 5);
    });

    it('ignores a non-positive density', () => {
        expect(convertUnit(150, 'g', 'ml', 0)).toBeNull();
        expect(convertUnit(150, 'g', 'ml', -1)).toBeNull();
    });
});

describe('resolveIngredientDensity', () => {
    it('prefers a recipe-level override over the database', () => {
        const resolved = resolveIngredientDensity('honey', database, { honey: 1.5 });
        expect(resolved).toEqual({ density: 1.5, isEstimate: false });
    });

    it('falls back to the database when no override is given', () => {
        const resolved = resolveIngredientDensity('honey', database);
        expect(resolved).toEqual({ density: 1.42, isEstimate: true });
    });

    it('returns null when neither an override nor a database entry exists', () => {
        expect(resolveIngredientDensity('water', database)).toBeNull();
    });
});

describe('parseDensityOverrides', () => {
    it('parses a list of "id:density" strings', () => {
        const overrides = parseDensityOverrides({ densities: ['water:1.0', 'honey:1.42'] });
        expect(overrides).toEqual({ water: 1.0, honey: 1.42 });
    });

    it('accepts a single non-array string', () => {
        const overrides = parseDensityOverrides({ densities: 'water:1.0' });
        expect(overrides).toEqual({ water: 1.0 });
    });

    it('ignores malformed entries', () => {
        const overrides = parseDensityOverrides({ densities: ['not-a-valid-entry', 'water:abc', 'honey:1.42'] });
        expect(overrides).toEqual({ honey: 1.42 });
    });

    it('returns an empty object when there is no densities field', () => {
        expect(parseDensityOverrides({})).toEqual({});
        expect(parseDensityOverrides(undefined)).toEqual({});
    });
});

describe('standardizeMass — density resolution regression', () => {
    it('marks a database-derived density as an estimate', () => {
        const result = standardizeMass(100, 'ml', database, 'honey');
        expect(result).toEqual({ mass: 142, method: 'density', isEstimate: true });
    });

    it('marks an override-derived density as explicit, not an estimate', () => {
        const result = standardizeMass(100, 'ml', database, 'honey', { honey: 1.5 });
        expect(result).toEqual({ mass: 150, method: 'explicit', isEstimate: false });
    });

    it('returns null for a volume unit with no density available anywhere', () => {
        expect(standardizeMass(100, 'ml', database, 'water')).toBeNull();
    });
});

describe('applyYield', () => {
    it('derives Net Mass forward from a unit_weight (Gross) conversion', () => {
        // 1 avocado: unit_weight=150g (Gross), yield=0.70 -> Net = 105g, Gross stays 150g
        const result = applyYield(150, 'unit_weight', 0.7);
        expect(result).toEqual({ normalizedMass: 105, purchasingMass: 150 });
    });

    it('derives Gross Mass backward from an explicit mass/volume (Net) conversion', () => {
        // 200g of avocado written directly: Net = 200g, Gross = 200/0.7 = 285.71g
        const result = applyYield(200, 'physical', 0.7);
        expect(result.normalizedMass).toBe(200);
        expect(result.purchasingMass).toBeCloseTo(285.71, 2);
    });

    it('is a no-op when there is no yield factor', () => {
        expect(applyYield(150, 'unit_weight', undefined)).toEqual({ normalizedMass: 150 });
    });

    it('is a no-op when yield is 1 (no waste)', () => {
        expect(applyYield(150, 'unit_weight', 1)).toEqual({ normalizedMass: 150 });
    });
});

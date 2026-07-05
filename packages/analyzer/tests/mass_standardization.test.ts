import { describe, it, expect } from 'bun:test';
import {
    convertUnit,
    resolveIngredientDensity,
    parseDensityOverrides,
    standardizeMass,
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

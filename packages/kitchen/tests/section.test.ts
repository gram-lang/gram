import { describe, it, expect } from 'bun:test';
import { aggregateSectionIngredients } from '../src/section';
import type { Usage } from '../src/types';

function usage(overrides: Partial<Usage>): Usage {
    return { id: 'sugar', ...overrides } as Usage;
}

describe('aggregateSectionIngredients', () => {
    it('sums normalizedMass across repeated measured occurrences of the same ingredient', () => {
        const [entry] = aggregateSectionIngredients([
            usage({ qty: 100, unit: 'g', normalizedMass: 100 }),
            usage({ qty: 100, unit: 'g', normalizedMass: 100 }),
        ]);
        expect(entry!.normalizedMass).toBe(200);
    });

    it("sums bakersPercentage across repeated occurrences, instead of keeping only the first one's value", () => {
        // Two 100g occurrences of an ingredient at 10% each (reference = 1000g)
        // must aggregate to 200g / 20%, not stay stuck at the first entry's 10%.
        const [entry] = aggregateSectionIngredients([
            usage({ qty: 100, unit: 'g', normalizedMass: 100, bakersPercentage: 10 } as any),
            usage({ qty: 100, unit: 'g', normalizedMass: 100, bakersPercentage: 10 } as any),
        ]);
        expect(entry!.normalizedMass).toBe(200);
        expect((entry as any).bakersPercentage).toBe(20);
    });

    it('does not add a bakersPercentage field when none of the occurrences have one', () => {
        const [entry] = aggregateSectionIngredients([
            usage({ qty: 100, unit: 'g', normalizedMass: 100 }),
            usage({ qty: 100, unit: 'g', normalizedMass: 100 }),
        ]);
        expect((entry as any).bakersPercentage).toBeUndefined();
    });

    it('rounds the summed bakersPercentage to 2 decimals', () => {
        const [entry] = aggregateSectionIngredients([
            usage({ qty: 1, unit: 'g', normalizedMass: 1, bakersPercentage: 0.1 } as any),
            usage({ qty: 1, unit: 'g', normalizedMass: 1, bakersPercentage: 0.2 } as any),
        ]);
        expect((entry as any).bakersPercentage).toBeCloseTo(0.3, 5);
    });
});

import { describe, it, expect } from 'bun:test';
import { GramConfigFileSchema } from '../src/types';

// Regression test for the security audit (Phase 3): `.gram/config.yaml` used to
// be cast (`as GramConfig`) with zero runtime validation, even though it can be
// shared/committed in a team repo. A malformed field should fail clearly at
// load time instead of surfacing as a confusing crash deep in the pipeline.

describe('GramConfigFileSchema', () => {
    it('accepts a minimal valid config', () => {
        const result = GramConfigFileSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('accepts a fully populated valid config', () => {
        const result = GramConfigFileSchema.safeParse({
            version: 1,
            database: '.gram/ingredients.yaml',
            language: 'en',
            ai: { provider: 'anthropic', model: 'claude-sonnet', apiKey: 'sk-x', baseUrl: 'https://example.com' },
        });
        expect(result.success).toBe(true);
    });

    it('rejects an unknown ai.provider value', () => {
        const result = GramConfigFileSchema.safeParse({ ai: { provider: 'not-a-real-provider' } });
        expect(result.success).toBe(false);
    });

    it('rejects a non-string database path', () => {
        const result = GramConfigFileSchema.safeParse({ database: 42 });
        expect(result.success).toBe(false);
    });
});

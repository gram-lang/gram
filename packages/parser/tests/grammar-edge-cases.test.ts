import { describe, it, expect } from 'bun:test';
import { getAST, ASTNodeType } from '../src/index';

// The audit (Phase 5) noted @gram-lang/parser — the foundation of the whole
// toolchain — had zero dedicated tests, only indirect coverage via kitchen's/
// analyzer's fixtures. These cover the grammar's basic constructs, one known
// hard-error path, and robustness against malformed/adversarial input (the
// language server parses arbitrary, possibly untrusted, .gram files on every
// keystroke — see Phase 3/4 — so a crash on bad input is a real concern).

describe('basic constructs', () => {
    it('parses a minimal recipe with a title, section, and ingredient', () => {
        const ast = getAST('---\ntitle: Pancakes\n---\n## Batter\nMix @flour{200g}.\n');
        expect(ast.type).toBe(ASTNodeType.Recipe);
        expect(ast.meta.title).toBe('Pancakes');
        expect(ast.children.length).toBeGreaterThan(0);
    });

    it('parses a composite ingredient (<@parent)', () => {
        const ast = getAST('## Section\n@egg-yolks{3}<@eggs\n');
        const json = JSON.stringify(ast);
        expect(json).toContain('"Composite"');
    });

    it('parses an alternative ingredient group (a|b)', () => {
        const ast = getAST('## Section\nUse @butter{50g}|@oil{50ml}.\n');
        const json = JSON.stringify(ast);
        expect(json).toContain('"Alternative"');
    });

    it('parses a relative quantity (50%@other)', () => {
        const ast = getAST('## Section\nAdd @water{50%@&flour}.\n');
        const json = JSON.stringify(ast);
        expect(json).toContain('"RelativeQuantity"');
    });

    it('parses a timer and a temperature token', () => {
        const ast = getAST('## Section\nBake at °{180C} for ~{20min}.\n');
        const json = JSON.stringify(ast);
        expect(json).toContain('"Timer"');
        expect(json).toContain('"Temperature"');
    });
});

describe('known hard error', () => {
    it('throws a descriptive syntax error for a space before the composite `<` sigil', () => {
        expect(() => getAST('## Section\n@ <@parent\n')).toThrow(/composite/i);
    });
});

describe('robustness against malformed / adversarial input', () => {
    it('does not throw on an empty document', () => {
        expect(() => getAST('')).not.toThrow();
    });

    it('does not throw on control characters / binary garbage', () => {
        expect(() => getAST('\x00\x01\x02 binary garbage\n')).not.toThrow();
    });

    it('does not throw on an unterminated quantity brace', () => {
        expect(() => getAST('## Section\nMix @flour{200g\n')).not.toThrow();
    });

    it('does not throw on deeply repeated sigils with no content', () => {
        expect(() => getAST('@'.repeat(500))).not.toThrow();
    });

    it('parses a large (100k char) document within a bounded time, guarding against catastrophic backtracking', () => {
        const big = `## Section\n${'Mix @flour{200g}. '.repeat(5000)}\n`;
        const start = performance.now();
        expect(() => getAST(big)).not.toThrow();
        expect(performance.now() - start).toBeLessThan(5000);
    });
});

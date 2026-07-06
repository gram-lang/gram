import { describe, it, expect } from 'bun:test';
import { getAST } from '@gram-lang/parser';
import { compile } from '../src/index';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

describe('Compiler Snapshots', () => {
    const fixturesDir = join(import.meta.dir, 'fixtures', 'valid');
    const files = readdirSync(fixturesDir).filter(f => f.endsWith('.gram'));

    for (const file of files) {
        it(`should compile ${file} correctly`, () => {
            const input = readFileSync(join(fixturesDir, file), 'utf-8');
            const ast = getAST(input);
            const result = compile(ast);
            expect(result).toMatchSnapshot();
        });
    }
});

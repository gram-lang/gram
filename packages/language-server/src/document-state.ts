import { getAST, RecipeAST } from '@gram/parser';
import { compile, CompilationResult } from '@gram/compiler';
import { buildLineIndex } from './utils/position';

export interface DocumentState {
    text: string;
    lineStarts: number[];
    ast: RecipeAST | null;
    parseError: string | null;
    compilation: CompilationResult | null;
}

export function parseDocument(text: string): DocumentState {
    const lineStarts = buildLineIndex(text);
    try {
        const ast = getAST(text);
        let compilation: CompilationResult | null = null;
        try {
            compilation = compile(ast);
        } catch {
            // compilation failures don't invalidate the AST
        }
        return { text, lineStarts, ast, parseError: null, compilation };
    } catch (e: any) {
        return { text, lineStarts, ast: null, parseError: String(e?.message ?? e), compilation: null };
    }
}

import { getAST, RecipeAST } from '@gram/parser';
import { compile, CompilationResult } from '@gram/kitchen';
import { analyze, AnalyzedCompilationResult, IngredientData } from '@gram/analyzer';
import { buildLineIndex } from './utils/position';

export interface DocumentState {
    text: string;
    lineStarts: number[];
    ast: RecipeAST | null;
    parseError: string | null;
    compilation: AnalyzedCompilationResult | CompilationResult | null;
}

export function parseDocument(text: string, db?: Record<string, IngredientData>): DocumentState {
    const lineStarts = buildLineIndex(text);
    try {
        const ast = getAST(text);
        let compilation: AnalyzedCompilationResult | CompilationResult | null = null;
        try {
            const rawCompilation = compile(ast);
            if (db) {
                const analyzed = analyze(rawCompilation, db);
                compilation = analyzed.result;
            } else {
                compilation = rawCompilation;
            }
        } catch {
            // compilation failures don't invalidate the AST
        }
        return { text, lineStarts, ast, parseError: null, compilation };
    } catch (e: any) {
        return { text, lineStarts, ast: null, parseError: String(e?.message ?? e), compilation: null };
    }
}

import { getAST, GramParseError, type RecipeAST } from "@gram-lang/parser";
import { compile, type CompilationResult } from "@gram-lang/kitchen";
import {
	analyze,
	type AnalyzedCompilationResult,
	type IngredientData,
} from "@gram-lang/analyzer";
import { buildLineIndex } from "./utils/position";

export interface DocumentState {
	text: string;
	lineStarts: number[];
	ast: RecipeAST | null;
	parseError: string | null;
	/** Character offset of `parseError` into `text`, when known. */
	parseErrorOffset: number | null;
	compilation: AnalyzedCompilationResult | CompilationResult | null;
}

export function parseDocument(
	text: string,
	db?: Record<string, IngredientData>,
): DocumentState {
	const lineStarts = buildLineIndex(text);
	try {
		const ast = getAST(text);
		let compilation: AnalyzedCompilationResult | CompilationResult | null =
			null;
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
		return {
			text,
			lineStarts,
			ast,
			parseError: null,
			parseErrorOffset: null,
			compilation,
		};
	} catch (e: any) {
		return {
			text,
			lineStarts,
			ast: null,
			parseError: String(e?.message ?? e),
			parseErrorOffset: e instanceof GramParseError ? e.offset : null,
			compilation: null,
		};
	}
}

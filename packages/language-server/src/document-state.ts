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
	/**
	 * The source TextDocument's version at the time this state was computed
	 * (undefined when parsed outside the LSP document-sync protocol, e.g. in
	 * tests). refresh() is debounced, so a cached state can lag behind the
	 * live document; edit-producing features
	 * (formatting, rename, code actions) must compare this against the live
	 * document's version and re-parse synchronously on mismatch rather than
	 * computing a TextEdit against stale text/offsets.
	 */
	version: number | undefined;
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
	version?: number,
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
			version,
			lineStarts,
			ast,
			parseError: null,
			parseErrorOffset: null,
			compilation,
		};
	} catch (e) {
		return {
			text,
			version,
			lineStarts,
			ast: null,
			parseError: String(e instanceof Error ? e.message : e),
			parseErrorOffset: e instanceof GramParseError ? e.offset : null,
			compilation: null,
		};
	}
}

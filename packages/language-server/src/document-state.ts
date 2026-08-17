import { getAST, GramParseError, type RecipeAST } from "@gram-lang/parser";
import { compile, type CompilationResult } from "@gram-lang/kitchen";
import {
	analyze,
	type AnalyzedCompilationResult,
	type IngredientData,
} from "@gram-lang/analyzer";
import {
	composeRecipe,
	finalizeComposed,
	type ModuleGraph,
} from "@gram-lang/modules";
import { buildLineIndex } from "./utils/position";

/**
 * The document's already-loaded `@use` graph, handed in by the caller —
 * `parseDocument` itself stays synchronous (module-imports RFC §F.1:
 * `loadModuleGraph` is async and lives in `server.ts`/`getFreshState`'s
 * graph cache; everything downstream of a materialized graph, including
 * this function, is synchronous). `cache` is the session-wide
 * yield-measurement cache (same role as the CLI's `opts.moduleCache`,
 * `packages/cli/src/core/pipeline.ts:59`) — reused across documents so a
 * base imported by several open files isn't re-measured on every keystroke
 * of each importer.
 */
export interface ModuleContext {
	graph: ModuleGraph;
	cache?: Map<string, AnalyzedCompilationResult>;
	lang?: string;
}

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
	/**
	 * The graph `compilation` was composed against, when this document has
	 * (or transitively depends on) `@use` imports — carries every dependency's
	 * own source, so `provideDiagnostics` can resolve a cross-file warning's
	 * `loc.uri` into a real position in *that* file for `relatedInformation`,
	 * without this document needing to re-read/re-parse it itself.
	 */
	moduleGraph?: ModuleGraph;
}

export function parseDocument(
	text: string,
	db?: Record<string, IngredientData>,
	version?: number,
	moduleCtx?: ModuleContext,
): DocumentState {
	const lineStarts = buildLineIndex(text);
	try {
		const ast = getAST(text);
		let compilation: AnalyzedCompilationResult | CompilationResult | null =
			null;
		try {
			// `state.ast` (above) always stays this document's own single-file
			// parse — document symbols, folding, semantic tokens, and
			// within-file go-to-definition must never see an imported
			// module's sections as if they were written in this file. Only
			// `compilation` is derived from the composed (spliced) AST, same
			// split as the CLI pipeline (`runPipeline`, `core/pipeline.ts:38`).
			let rawCompilation: CompilationResult;
			if (moduleCtx) {
				const composed = composeRecipe(moduleCtx.graph, {
					db: db ?? {},
					lang: moduleCtx.lang,
					cache: moduleCtx.cache,
				});
				rawCompilation = finalizeComposed(compile(composed.ast), composed);
			} else {
				rawCompilation = compile(ast);
			}
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
			moduleGraph: moduleCtx?.graph,
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

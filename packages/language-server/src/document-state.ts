import { getAST, GramParseError, type RecipeAST } from "@gram-lang/parser";
import {
	applyScale,
	compile,
	resolveScaleFactor,
	type CompilationResult,
} from "@gram-lang/kitchen";
import {
	analyze,
	convertUnit,
	parseDensityOverrides,
	resolveIngredientDensity,
	type AnalyzedCompilationResult,
	type IngredientData,
} from "@gram-lang/analyzer";
import {
	DEFAULT_RECIPE_SETTINGS,
	type RecipeSettings,
	recipeSettingsToAnalyzerOptions,
} from "@gram-lang/renderer";
import {
	composeRecipe,
	finalizeComposed,
	type ModuleGraph,
} from "@gram-lang/modules";
import type { CompileSession } from "./session";
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
	/**
	 * The AST `compilation` was compiled from: `ast` with its `@use` imports
	 * spliced in. What the AST inspector shows; never what document symbols,
	 * folding or semantic tokens read (they stay on this file's own `ast`).
	 */
	composedAst?: RecipeAST | null;
	parseError: string | null;
	/** Character offset of `parseError` into `text`, when known. */
	parseErrorOffset: number | null;
	/** Error message from compile() or analyze() when AST parsing succeeded but compilation failed. */
	compileError?: string | null;
	compilation: AnalyzedCompilationResult | CompilationResult | null;
	/**
	 * Why the session's scale could not be applied (an ingredient the recipe
	 * does not have, a unit that does not convert). Not blocking, as in the
	 * playground: `compilation` is then the recipe at its written size.
	 */
	scaleError?: string | null;
	/**
	 * The graph `compilation` was composed against, when this document has
	 * (or transitively depends on) `@use` imports — carries every dependency's
	 * own source, so `provideDiagnostics` can resolve a cross-file warning's
	 * `loc.uri` into a real position in *that* file for `relatedInformation`,
	 * without this document needing to re-read/re-parse it itself.
	 */
	moduleGraph?: ModuleGraph;
}

/**
 * `compiled` at the session's scale, as the playground scales it: a factor, or
 * the factor that gives the target quantity of one ingredient (converting
 * between mass and volume when a density is known). Throws a scale error,
 * which `parseDocument` keeps as not blocking.
 */
function scaleOf(
	compiled: CompilationResult,
	session: CompileSession,
	db: Record<string, IngredientData>,
): CompilationResult {
	const request = session.scale;
	if (!request) return compiled;
	const density =
		request.type === "target"
			? resolveIngredientDensity(
					request.id,
					db,
					parseDensityOverrides(compiled.meta),
				)?.density
			: undefined;
	const resolution = resolveScaleFactor(compiled, request, (value, from, to) =>
		convertUnit(
			value,
			from,
			to,
			density,
			typeof compiled.meta?.language === "string"
				? compiled.meta.language
				: undefined,
		),
	);
	return applyScale(compiled, resolution.factor);
}

export function parseDocument(
	text: string,
	db?: Record<string, IngredientData>,
	version?: number,
	moduleCtx?: ModuleContext,
	/** What the analyzer computes (`gram.bakersMath`, ...). Default: everything, as the engine. */
	recipe: RecipeSettings = DEFAULT_RECIPE_SETTINGS,
	/**
	 * What the cook chose for this sitting (scale, stock, baker's reference).
	 * Only the views are compiled with it: diagnostics, hover and inlay hints
	 * read the source as written, so the server parses without it for them.
	 */
	session?: CompileSession,
): DocumentState {
	const lineStarts = buildLineIndex(text);
	try {
		const ast = getAST(text);
		let compilation: AnalyzedCompilationResult | CompilationResult | null =
			null;
		let compileError: string | null = null;
		let composedAst: RecipeAST | null = null;
		let scaleError: string | null = null;
		const scaled = (
			compiled: CompilationResult,
			sitting: CompileSession | undefined,
			scaleDb: Record<string, IngredientData>,
		): CompilationResult => {
			if (!sitting?.scale) return compiled;
			try {
				return scaleOf(compiled, sitting, scaleDb);
			} catch (e) {
				scaleError = String(e instanceof Error ? e.message : e);
				return compiled;
			}
		};
		try {
			// `state.ast` (above) always stays this document's own single-file
			// parse — document symbols, folding, semantic tokens, and
			// within-file go-to-definition must never see an imported
			// module's sections as if they were written in this file. Only
			// `compilation` is derived from the composed (spliced) AST, same
			// split as the CLI pipeline (`runPipeline`, `core/pipeline.ts:38`).
			let rawCompilation: CompilationResult;
			let syntheticIngredients: Record<string, IngredientData> = {};
			if (moduleCtx) {
				const composed = composeRecipe(moduleCtx.graph, {
					db: db ?? {},
					lang: moduleCtx.lang,
					cache: moduleCtx.cache,
					...(session?.stock && { stock: new Set(session.stock) }),
				});
				composedAst = composed.ast;
				syntheticIngredients = composed.syntheticIngredients;
				rawCompilation = finalizeComposed(
					scaled(compile(composed.ast), session, {
						...syntheticIngredients,
						...db,
					}),
					composed,
				);
			} else {
				composedAst = ast;
				rawCompilation = scaled(compile(ast), session, db ?? {});
			}
			if (db) {
				// Real DB entries always win on id collision, same as the CLI's
				// `pipeline.ts` and the playground — a stocked import's binding
				// must not shadow an existing ingredient's real nutrition/mass
				// data (MODULE_BINDING_SHADOWS_INGREDIENT).
				const analyzed = analyze(
					rawCompilation,
					{
						...syntheticIngredients,
						...db,
					},
					{
						...recipeSettingsToAnalyzerOptions(recipe),
						...(session?.bakersReference && {
							bakersReference: session.bakersReference,
						}),
					},
				);
				compilation = analyzed.result;
			} else {
				compilation = rawCompilation;
			}
		} catch (e) {
			// compilation failures don't invalidate the AST, but are captured for webview notifications
			compileError = String(e instanceof Error ? e.message : e);
		}
		return {
			text,
			version,
			lineStarts,
			ast,
			parseError: null,
			parseErrorOffset: null,
			composedAst,
			compileError,
			compilation,
			scaleError,
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
			compileError: null,
			compilation: null,
		};
	}
}

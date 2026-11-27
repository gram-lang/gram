import { readFile } from "node:fs/promises";
import { dirname, resolve as resolvePath } from "node:path";
import { GramParseError, getAST, type RecipeAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { analyze } from "@gram-lang/analyzer";
import {
	DEFAULT_RECIPE_SETTINGS,
	recipeSettingsToAnalyzerOptions,
} from "@gram-lang/renderer";
import {
	loadModuleGraph,
	composeRecipe,
	finalizeComposed,
	ModuleWarningCode,
	type ModuleGraph,
} from "@gram-lang/modules";
import type { CompilationResult } from "@gram-lang/kitchen";
import type { AnalysisResult } from "@gram-lang/analyzer";
import type { PipelineOptions } from "../types";
import { GramCLIError, ExitCode, getErrorMessage } from "../errors";
import { createCliModuleHost } from "./module-host";
import { findProjectRoot } from "./workspace";

export interface PipelineResult {
	content: string;
	compiled: CompilationResult;
	analyzed: AnalysisResult | null;
	// The subset of `opts.stock` that actually matched a `@use` in this file
	// — empty when `opts.stock` is unset. Glob-driven commands (`build`/`shop`
	// over `**/*.gram`) union this across every file processed, then diff
	// against the full requested `--stock` set once at the end of the whole
	// invocation to warn about a leftover entry that never matched anything.
	usedStock: Set<string>;
	// Every file the recipe was read from, or tried to be: the entry file and
	// each `@use` import, transitive ones included, a missing one too (it is a
	// diagnostic, not an error), as absolute paths. Empty for
	// `runPipelineFromSource`. What a live preview watches: an import written
	// before its file resolves as soon as the file is created.
	dependencies: string[];
}

/** A recipe file read from disk, with every `@use` module it imports. */
interface LoadedEntry {
	entryUri: string;
	projectRoot: string;
	content: string;
	graph: ModuleGraph;
	dependencies: Set<string>;
}

async function loadEntry(
	filePath: string,
	opts: PipelineOptions,
): Promise<LoadedEntry> {
	const entryUri = resolvePath(filePath);
	let content: string;
	try {
		content = await readFile(entryUri, "utf-8");
	} catch (err) {
		if ((err as { code?: string }).code === "ENOENT") {
			throw new GramCLIError(`File not found: ${filePath}`, ExitCode.Error);
		}
		throw err;
	}

	const projectRoot = await findProjectRoot(dirname(entryUri));
	const dependencies = new Set<string>([entryUri]);
	const host = createCliModuleHost(projectRoot, opts.paths, (uri) => {
		dependencies.add(uri);
		return readFile(uri, "utf-8");
	});
	const graph = await loadModuleGraph(entryUri, host);
	return { entryUri, projectRoot, content, graph, dependencies };
}

/** Composes, compiles and (with a database) analyzes a loaded recipe. */
function compileEntry(
	{ graph }: LoadedEntry,
	opts: PipelineOptions,
): {
	compiled: CompilationResult;
	analyzed: AnalysisResult | null;
	usedStock: Set<string>;
} {
	const composed = composeRecipe(graph, {
		db: opts.db ?? {},
		lang: opts.lang,
		cache: opts.moduleCache,
		stock: opts.stock,
	});

	const compiled = compile(
		composed.ast,
		opts.scaleFactor ? { scaleFactor: opts.scaleFactor } : undefined,
	);
	const tagged = finalizeComposed(compiled, composed);

	const analyzed =
		!opts.skipAnalyzer && opts.db
			? analyze(
					tagged,
					// Real DB entries always win on id collision (§D.6's
					// host-always-wins policy) — a stocked import whose binding
					// name happens to slugify to an existing ingredient id
					// (MODULE_BINDING_SHADOWS_INGREDIENT) must not silently
					// override that ingredient's real nutrition/mass data for
					// every other reference to it in the document.
					{ ...composed.syntheticIngredients, ...opts.db },
					{
						...recipeSettingsToAnalyzerOptions(
							opts.recipe ?? DEFAULT_RECIPE_SETTINGS,
						),
						bakersReference: opts.bakersReference,
						lang: opts.lang,
					},
				)
			: null;

	return { compiled: tagged, analyzed, usedStock: composed.usedStock };
}

/**
 * Every entry point (build/check/shop/scale/view/cook) runs through here,
 * so this is where `@use` imports are resolved -- unconditionally, even for
 * a file with none, so there's exactly one code path rather than a
 * has-imports branch to keep in sync. For a file with no `@use` at all,
 * `loadModuleGraph` does the one file read this function needed anyway and
 * `composeRecipe` is a pass-through (nothing to splice), so this costs
 * nothing extra over the old direct getAST+compile path.
 *
 * `gram import`'s in-memory content (`runPipelineFromSource`, no file path
 * to resolve against) deliberately does NOT go through module resolution --
 * see `prompts/gram-spec.ts`'s own note on why `@use` is never taught to
 * the AI importer.
 */
export async function runPipeline(
	filePath: string,
	opts: PipelineOptions = {},
): Promise<PipelineResult> {
	const entry = await loadEntry(filePath, opts);
	// A syntax error in an imported module is a diagnostic: the recipe still
	// compiles around it. One in the recipe itself leaves nothing to compile,
	// and the graph would hand back an empty document every command shows as
	// an empty recipe. Parse it again to throw the parser's own error, as
	// `runPipelineFromSource` does (error path only).
	if (
		entry.graph.diagnostics.some(
			(d) =>
				d.code === ModuleWarningCode.MODULE_PARSE_ERROR &&
				(d.uri ?? d.loc?.uri) === entry.entryUri,
		)
	) {
		getAST(entry.content);
	}
	const { compiled, analyzed, usedStock } = compileEntry(entry, opts);

	return {
		content: entry.content,
		compiled,
		analyzed,
		usedStock,
		dependencies: [...entry.dependencies],
	};
}

/** What `lintDocument` needs of one file, as `gram check` prepared it. */
export interface LintPipelineResult {
	/** The file's absolute path, the `uri` of its diagnostics. */
	uri: string;
	/** The project the file belongs to (its `.gram/config.yaml`). */
	projectRoot: string;
	text: string;
	/** Its own AST (not the composed one); null when it does not parse. */
	ast: RecipeAST | null;
	parseError: { message: string; offset: number | null } | null;
	/** The analyzed recipe with a database, else the compiled one. */
	compilation: CompilationResult | null;
	compileError: string | null;
	moduleGraph: ModuleGraph;
	/** Each `@use` module's text, by uri, to place a `related` position. */
	sources: Map<string, string>;
	usedStock: Set<string>;
}

/**
 * The pipeline as `gram check` runs it: the same reading, composing,
 * compiling and analyzing as `runPipeline`, prepared the way the language
 * server prepares a document for `lintDocument` (`parseDocument`): the
 * file's own AST, the composed compilation (analyzed when a database is
 * given), and what went wrong kept as data rather than thrown. Only a file
 * that cannot be read throws.
 */
export async function runLintPipeline(
	filePath: string,
	opts: PipelineOptions = {},
): Promise<LintPipelineResult> {
	const entry = await loadEntry(filePath, opts);
	const sources = new Map<string, string>();
	for (const [uri, mod] of entry.graph.modules) sources.set(uri, mod.source);
	const base = {
		uri: entry.entryUri,
		projectRoot: entry.projectRoot,
		text: entry.content,
		moduleGraph: entry.graph,
		sources,
	};

	let ast: RecipeAST;
	try {
		ast = getAST(entry.content);
	} catch (e) {
		return {
			...base,
			ast: null,
			parseError: {
				message: getErrorMessage(e),
				offset: e instanceof GramParseError ? e.offset : null,
			},
			compilation: null,
			compileError: null,
			usedStock: new Set(),
		};
	}

	try {
		const { compiled, analyzed, usedStock } = compileEntry(entry, opts);
		return {
			...base,
			ast,
			parseError: null,
			compilation: analyzed ? analyzed.result : compiled,
			compileError: null,
			usedStock,
		};
	} catch (e) {
		return {
			...base,
			ast,
			parseError: null,
			compilation: null,
			compileError: getErrorMessage(e),
			usedStock: new Set(),
		};
	}
}

/**
 * The pipeline itself, on text rather than a path.
 *
 * Split out for `gram import`, whose .gram content only exists in memory: it
 * needs the same compile-and-analyze that every other command runs, and
 * re-implementing the three calls there would be a second definition of what
 * "run the pipeline" means. Synchronous — nothing here touches the disk.
 */
export function runPipelineFromSource(
	content: string,
	opts: PipelineOptions = {},
): PipelineResult {
	const ast = getAST(content);
	const compiled = compile(
		ast,
		opts.scaleFactor ? { scaleFactor: opts.scaleFactor } : undefined,
	);

	const analyzed =
		!opts.skipAnalyzer && opts.db
			? analyze(compiled, opts.db, {
					// No `portions` override: the analyzer reads the recipe's own
					// `portions:` frontmatter. This used to pass `opts.scaleFactor`,
					// which meant per-portion nutrition never appeared without
					// --scale, and divided by the scale factor when it did.
					// `applyScale` scales meta.portions too, so a scaled recipe
					// keeps the right divisor on its own.
					...recipeSettingsToAnalyzerOptions(
						opts.recipe ?? DEFAULT_RECIPE_SETTINGS,
					),
					bakersReference: opts.bakersReference,
					lang: opts.lang,
				})
			: null;

	return {
		content,
		compiled,
		analyzed,
		usedStock: new Set(),
		dependencies: [],
	};
}

import { readFile } from "node:fs/promises";
import { dirname, resolve as resolvePath } from "node:path";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { analyze } from "@gram-lang/analyzer";
import {
	loadModuleGraph,
	composeRecipe,
	finalizeComposed,
} from "@gram-lang/modules";
import type { CompilationResult } from "@gram-lang/kitchen";
import type { AnalysisResult } from "@gram-lang/analyzer";
import type { PipelineOptions } from "../types";
import { GramCLIError, ExitCode } from "../errors";
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
	const host = createCliModuleHost(projectRoot, opts.paths);
	const graph = await loadModuleGraph(entryUri, host);
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
						bakersReference: opts.bakersReference,
						lang: opts.lang,
					},
				)
			: null;

	return { content, compiled: tagged, analyzed, usedStock: composed.usedStock };
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
					bakersReference: opts.bakersReference,
					lang: opts.lang,
				})
			: null;

	return { content, compiled, analyzed, usedStock: new Set() };
}

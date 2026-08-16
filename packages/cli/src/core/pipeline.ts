import { readFile } from "node:fs/promises";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { analyze } from "@gram-lang/analyzer";
import type { CompilationResult } from "@gram-lang/kitchen";
import type { AnalysisResult } from "@gram-lang/analyzer";
import type { PipelineOptions } from "../types";
import { GramCLIError, ExitCode } from "../errors";

export interface PipelineResult {
	content: string;
	compiled: CompilationResult;
	analyzed: AnalysisResult | null;
}

export async function runPipeline(
	filePath: string,
	opts: PipelineOptions = {},
): Promise<PipelineResult> {
	let content: string;
	try {
		content = await readFile(filePath, "utf-8");
	} catch (err) {
		if ((err as { code?: string }).code === "ENOENT") {
			throw new GramCLIError(`File not found: ${filePath}`, ExitCode.Error);
		}
		throw err;
	}
	return runPipelineFromSource(content, opts);
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

	return { content, compiled, analyzed };
}

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
		if ((err as NodeJS.ErrnoException).code === "ENOENT") {
			throw new GramCLIError(`File not found: ${filePath}`, ExitCode.Error);
		}
		throw err;
	}
	const ast = getAST(content);
	const compiled = compile(
		ast,
		opts.scaleFactor ? { scaleFactor: opts.scaleFactor } : undefined,
	);

	const analyzed =
		!opts.skipAnalyzer && opts.db
			? analyze(compiled, opts.db, {
					portions: opts.scaleFactor,
					bakersReference: opts.bakersReference,
				})
			: null;

	return { content, compiled, analyzed };
}

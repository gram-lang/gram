import pLimit from "p-limit";
import { basename } from "node:path";
import type { AnalyzedCompilationResult } from "@gram-lang/analyzer";
import { runPipeline } from "../core/pipeline";
import type { BuildOptions, BuildResult } from "../types";

export async function buildFiles(
	files: string[],
	opts: BuildOptions = {},
): Promise<BuildResult[]> {
	const limit = pLimit(20);
	// Shared across every file in this batch (module-imports RFC §F.1): a
	// base imported by several of these recipes is compiled+analyzed once
	// for its own yield, not once per importer.
	const moduleCache = new Map<string, AnalyzedCompilationResult>();
	return Promise.all(
		files.map((file) =>
			limit(async () => {
				const { compiled, analyzed } = await runPipeline(file, {
					db: opts.db,
					scaleFactor: opts.scaleFactor,
					lang: opts.lang,
					paths: opts.paths,
					moduleCache,
				});
				return {
					slug: basename(file, ".gram"),
					file,
					data: (analyzed ?? compiled) as object,
				};
			}),
		),
	);
}

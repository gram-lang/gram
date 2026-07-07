import pLimit from "p-limit";
import { basename } from "node:path";
import { runPipeline } from "../core/pipeline";
import type { BuildOptions, BuildResult } from "../types";

export async function buildFiles(
	files: string[],
	opts: BuildOptions = {},
): Promise<BuildResult[]> {
	const limit = pLimit(20);
	return Promise.all(
		files.map((file) =>
			limit(async () => {
				const { compiled, analyzed } = await runPipeline(file, {
					db: opts.db,
					scaleFactor: opts.scaleFactor,
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

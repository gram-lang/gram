import { defineCommand } from "citty";
import { resolve } from "node:path";
import { log, spinner } from "@clack/prompts";
import { version } from "../../package.json";
import { loadConfig } from "../core/config";
import { loadDbSafe } from "../core/db";
import { runPipeline } from "../core/pipeline";
import { reportRejectedIngredients } from "../ui/diagnostics";
import {
	resolveScaleFactor,
	buildScaleComparison,
	getScaleWarnings,
} from "../services/scaler";
import { renderScaleResult } from "../ui/scaler";
import { ExitCode, reportError } from "../errors";

export default defineCommand({
	meta: {
		name: "scale",
		version,
		description:
			"Display a before/after comparison of ingredient quantities at a given scale",
	},
	args: {
		file: {
			type: "positional",
			required: true,
			description: ".gram recipe file to scale",
		},
		scale: {
			type: "string",
			description:
				"Scale factor (e.g. 1.5, 2) or reference ingredient (e.g. farine=300g)",
		},
		db: {
			type: "string",
			description: "Path to ingredient database YAML",
		},
		"skip-db": {
			type: "boolean",
			description: "Skip ingredient database",
			default: false,
		},
	},
	async run({ args }) {
		if (!args.scale) {
			log.error(
				"Provide --scale <factor|ref>. Examples: --scale 2  or  --scale farine=300g",
			);
			process.exit(ExitCode.Error);
		}

		const filePath = resolve(args.file as string);
		const config = await loadConfig();
		const dbResult = args["skip-db"] ? null : await loadDbSafe(config, args.db);
		if (dbResult) reportRejectedIngredients(dbResult.rejected, dbResult.dbPath);
		const db = dbResult?.data ?? null;

		const s = spinner();
		s.start("Computing scaled quantities…");

		try {
			const factor = await resolveScaleFactor(
				filePath,
				args.scale as string,
				db,
				config.language,
				config.paths,
			);

			const [{ compiled: original }, { compiled: scaled }] = await Promise.all([
				runPipeline(filePath, {
					db,
					skipAnalyzer: !db,
					lang: config.language,
					paths: config.paths,
				}),
				runPipeline(filePath, {
					db,
					skipAnalyzer: !db,
					scaleFactor: factor,
					lang: config.language,
					paths: config.paths,
				}),
			]);

			s.stop("Done.");

			const items = buildScaleComparison(
				original.shopping_list,
				scaled.shopping_list,
			);
			const warnings = getScaleWarnings(factor, original.metrics.totalTime);
			renderScaleResult(original.title, factor, items, warnings);
		} catch (err) {
			s.stop("Failed.");
			reportError(err);
			process.exit(ExitCode.Error);
		}
	},
});

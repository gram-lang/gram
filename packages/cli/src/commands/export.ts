import { defineCommand } from "citty";
import { writeFile } from "node:fs/promises";
import { resolve, join, dirname, basename, extname } from "node:path";
import { log } from "@clack/prompts";
import chalk from "chalk";
import { loadConfig } from "../core/config";
import { loadDbSafe } from "../core/db";
import { reportUnusedStock, resolveStockFromConfig } from "../core/stock";
import { resolveScaleArg } from "../services/scaler";
import { exportRecipe } from "../services/exporter";
import { reportRejectedIngredients } from "../ui/diagnostics";
import {
	PLAN_FLAG_ARGS,
	VIEW_FLAG_ARG,
	resolveExportView,
} from "../services/plan-options";
import { DEFAULT_VIEW_SETTINGS } from "@gram-lang/renderer";
import {
	EXPORT_EXTENSIONS,
	EXPORT_FORMATS,
	cliViewName,
	resolveCliFormat,
} from "../core/cli-views";
import {
	EXPORT_VIEW_SETTINGS,
	STEP_QTY_ALIAS_ARG,
	readRecipeSettingArgs,
	readViewSettingArgs,
	recipeSettingArgs,
	viewSettingArgs,
} from "../services/setting-args";
import { ExitCode, GramCLIError } from "../errors";

export default defineCommand({
	meta: {
		name: "export",
		description:
			"Export a view of a recipe (see --view) to Markdown, print-ready HTML or plain text",
	},
	args: {
		file: {
			type: "positional",
			required: true,
			description: "Path to a .gram recipe file",
		},
		format: {
			type: "string",
			description:
				"Output format: md (Markdown), html (print-ready A4 HTML) or text (plain text), among those the chosen view has",
		},
		output: {
			type: "string",
			alias: "o",
			description:
				"Output file path (default: same directory as input, with new extension; the view's name before it for any view but the recipe, e.g. .run-sheet)",
		},
		scale: {
			type: "string",
			description:
				"Scale factor (e.g. 1.5) or reference ingredient (e.g. farine=300g)",
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
		...viewSettingArgs(EXPORT_VIEW_SETTINGS),
		...STEP_QTY_ALIAS_ARG,
		...recipeSettingArgs(),
		"bakers-reference": {
			type: "string",
			description:
				"Force a specific ingredient as the baker's math reference (e.g. flour). Implies --bakers-math",
		},
		...VIEW_FLAG_ARG,
		...PLAN_FLAG_ARGS,
		stock: {
			type: "string",
			description:
				"Comma-separated @use specifiers already on hand for this export (e.g. @bases/pate.gram,./levain.gram)",
		},
	},
	async run({ args, rawArgs }) {
		const fmt = args.format as string | undefined;
		if (!fmt) {
			log.error(
				`--format is required. Use --format ${Object.keys(EXPORT_FORMATS).join(", --format ")}.`,
			);
			process.exit(ExitCode.Error);
		}

		const filePath = resolve(args.file as string);
		const config = await loadConfig();
		const dbResult = args["skip-db"] ? null : await loadDbSafe(config, args.db);
		if (dbResult) reportRejectedIngredients(dbResult.rejected, dbResult.dbPath);
		const db = dbResult?.data ?? null;

		const scaleFactor = await resolveScaleArg(
			args.scale as string | undefined,
			filePath,
			db,
			config.language,
			config.paths,
		);

		const bakersReference =
			(args["bakers-reference"] as string) ||
			(args["bakers-math"] ? "" : undefined);
		const settings = readViewSettingArgs(args, EXPORT_VIEW_SETTINGS);
		const recipe = readRecipeSettingArgs(args);
		let view: ReturnType<typeof resolveExportView>;
		let format: ReturnType<typeof resolveCliFormat>;
		try {
			view = resolveExportView(args, rawArgs, config);
			format = resolveCliFormat(view.view, fmt, EXPORT_FORMATS);
		} catch (err) {
			if (err instanceof GramCLIError) {
				log.error(err.message);
				process.exit(err.exitCode);
			}
			throw err;
		}
		const stock = resolveStockFromConfig(args.stock, config);

		const outputPath = args.output
			? resolve(args.output as string)
			: join(
					dirname(filePath),
					`${basename(filePath, extname(filePath))}${view.view.id === "recipe" ? "" : `.${cliViewName(view.view.id)}`}.${EXPORT_EXTENSIONS[fmt] ?? fmt}`,
				);

		let content: string;
		let usedStock = new Set<string>();

		try {
			content = await exportRecipe(filePath, format, db, scaleFactor, {
				settings: { ...DEFAULT_VIEW_SETTINGS, ...settings },
				bakersReference,
				recipe,
				view,
				lang: config.language,
				paths: config.paths,
				stock,
				onUsedStock: (used) => {
					usedStock = used;
				},
			});
		} catch (err) {
			if (err instanceof GramCLIError) {
				log.error(err.message);
				process.exit(err.exitCode);
			}
			throw err;
		}

		reportUnusedStock("gram export", "exported", stock, [{ usedStock }]);
		await writeFile(outputPath, content, "utf-8");
		log.success(`Exported to ${chalk.dim(outputPath)}`);
	},
});

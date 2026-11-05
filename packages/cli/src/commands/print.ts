import { defineCommand } from "citty";
import { resolve } from "node:path";
import { log } from "@clack/prompts";
import chalk from "chalk";
import { loadConfig } from "../core/config";
import { loadDbSafe } from "../core/db";
import { reportUnusedStock, resolveStockFromConfig } from "../core/stock";
import { resolveScaleArg } from "../services/scaler";
import { generatePrintHTML, openInBrowser } from "../services/printer";
import { reportRejectedIngredients } from "../ui/diagnostics";
import {
	PLAN_FLAG_ARGS,
	VIEW_FLAG_ARG,
	resolveExportView,
} from "../services/plan-options";
import { DEFAULT_VIEW_SETTINGS } from "@gram-lang/renderer";
import { cliViewName } from "../core/cli-views";
import {
	RECIPE_VIEW_SETTINGS,
	STEP_QTY_ALIAS_ARG,
	readRecipeSettingArgs,
	readViewSettingArgs,
	recipeSettingArgs,
	viewSettingArgs,
} from "../services/setting-args";
import { ExitCode, GramCLIError } from "../errors";

export default defineCommand({
	meta: {
		name: "print",
		description:
			"Generate a print-ready HTML of a view (the recipe or its work plan) and open it in the browser",
	},
	args: {
		file: {
			type: "positional",
			required: true,
			description: "Path to a .gram recipe file",
		},
		open: {
			type: "boolean",
			description:
				"Open the generated HTML in the browser (use --no-open to skip)",
			default: true,
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
		...viewSettingArgs(RECIPE_VIEW_SETTINGS),
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
				"Comma-separated @use specifiers already on hand for this print (e.g. @bases/pate.gram,./levain.gram)",
		},
	},
	async run({ args, rawArgs }) {
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
		const settings = readViewSettingArgs(args, RECIPE_VIEW_SETTINGS);
		const recipe = readRecipeSettingArgs(args);
		let view: ReturnType<typeof resolveExportView>;
		try {
			view = resolveExportView(args, rawArgs, config);
			// Every view a command offers has a print layout today; one that
			// does not is refused here rather than half-printed.
			if (!view.view.formats.includes("print")) {
				throw new GramCLIError(
					`The ${cliViewName(view.view.id)} view has no print layout: use gram export instead.`,
					ExitCode.Error,
				);
			}
		} catch (err) {
			if (err instanceof GramCLIError) {
				log.error(err.message);
				process.exit(err.exitCode);
			}
			throw err;
		}
		const stock = resolveStockFromConfig(args.stock, config);

		let htmlPath: string;
		let usedStock = new Set<string>();
		try {
			htmlPath = await generatePrintHTML(filePath, db, scaleFactor, {
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

		reportUnusedStock("gram print", "printed", stock, [{ usedStock }]);
		log.success(`HTML generated: ${chalk.dim(htmlPath)}`);

		if (args.open !== false) {
			const opened = openInBrowser(htmlPath);
			if (opened) {
				log.info("Opening in browser…");
			} else {
				log.warn(
					`Could not open browser automatically. Open the file manually:\n${htmlPath}`,
				);
			}
		}
	},
});

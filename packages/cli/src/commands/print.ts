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
import { PLAN_FLAG_ARGS, resolvePlanContext } from "../services/plan-options";
import {
	DEFAULT_VIEW_SETTINGS,
	viewSettingsToRendererOptions,
} from "@gram-lang/renderer";
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
		description: "Generate a print-ready HTML and open it in the browser",
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
		...PLAN_FLAG_ARGS,
		"with-sheet": {
			type: "boolean",
			description:
				"With --serve: also write the production sheet after the recipe, in the same document",
		},
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
		const plan = resolvePlanContext(args, rawArgs, config);
		if (args["with-sheet"] && !plan) {
			log.error("--with-sheet needs --serve (when it is served).");
			process.exit(ExitCode.Error);
		}
		if (plan && !args["with-sheet"]) {
			log.error(
				"--serve only applies with --with-sheet: the recipe itself reads the same at any time.",
			);
			process.exit(ExitCode.Error);
		}
		const stock = resolveStockFromConfig(args.stock, config);

		let htmlPath: string;
		let usedStock = new Set<string>();
		try {
			htmlPath = await generatePrintHTML(filePath, db, scaleFactor, {
				...viewSettingsToRendererOptions({
					...DEFAULT_VIEW_SETTINGS,
					...settings,
				}),
				bakersReference,
				recipe,
				plan,
				withSheet: args["with-sheet"] as boolean | undefined,
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

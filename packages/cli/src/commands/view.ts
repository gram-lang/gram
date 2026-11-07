import { defineCommand } from "citty";
import { log } from "@clack/prompts";
import chalk from "chalk";
import { resolve } from "node:path";
import { version } from "../../package.json";
import { loadConfig } from "../core/config";
import { loadDbSafe } from "../core/db";
import { reportUnusedStock, resolveStockFromConfig } from "../core/stock";
import { viewRecipe } from "../services/viewer";
import { outputPaged } from "../ui/pager";
import { terminalTextStyle } from "../ui/text-style";
import { reportRejectedIngredients } from "../ui/diagnostics";
import { resolveScaleArg, getScaleWarnings } from "../services/scaler";
import {
	RECIPE_VIEW_SETTINGS,
	readRecipeSettingArgs,
	readViewSettingArgs,
	recipeSettingArgs,
	STEP_QTY_ALIAS_ARG,
	viewSettingArgs,
} from "../services/setting-args";
import { ExitCode, exitOnError } from "../errors";

/** The notice under the recipe when some ingredients have no nutrition data. */
function missingNutritionNotice(missing: string[]): string {
	if (missing.length === 0) return "";
	return `\n${chalk.yellow(
		`⚠ ${missing.length} ingredient${missing.length !== 1 ? "s" : ""} missing nutrition data — run \`gram db enrich\``,
	)}\n`;
}

export default defineCommand({
	meta: {
		name: "view",
		version,
		description: "Display a recipe in the terminal",
	},
	args: {
		file: {
			type: "positional",
			required: true,
			description: "Path to a .gram recipe file",
		},
		scale: {
			type: "string",
			description:
				"Scale factor (e.g. 1.5) or reference ingredient (e.g. farine=300g)",
		},
		db: {
			type: "string",
			description:
				"Ingredient database YAML (overrides config) — enables nutrition",
		},
		"skip-db": {
			type: "boolean",
			description: "Ignore the database even if configured",
		},
		"no-pager": {
			type: "boolean",
			description: "Disable automatic pager for long recipes",
		},
		...viewSettingArgs(RECIPE_VIEW_SETTINGS),
		...STEP_QTY_ALIAS_ARG,
		...recipeSettingArgs(),
		"bakers-reference": {
			type: "string",
			description:
				"Force a specific ingredient as the baker's math reference (e.g. flour). Implies --bakers-math",
		},
		stock: {
			type: "string",
			description:
				"Comma-separated @use specifiers already on hand for this view (e.g. @bases/pate.gram,./levain.gram)",
		},
	},
	async run({ args }) {
		const file = resolve(args.file as string);
		const config = await loadConfig();
		const dbResult = args["skip-db"] ? null : await loadDbSafe(config, args.db);
		if (dbResult) reportRejectedIngredients(dbResult.rejected, dbResult.dbPath);
		const db = dbResult?.data ?? null;

		const scaleFactor =
			(await resolveScaleArg(
				args.scale as string | undefined,
				file,
				db,
				config.language,
				config.paths,
			)) ?? 1;

		const bakersReference =
			(args["bakers-reference"] as string) ||
			(args["bakers-math"] ? "" : undefined);
		const settings = readViewSettingArgs(args, RECIPE_VIEW_SETTINGS);
		const recipe = readRecipeSettingArgs(args);
		const stock = resolveStockFromConfig(args.stock, config);

		// The colors follow chalk's detection (a terminal, NO_COLOR, FORCE_COLOR):
		// a pager is only started on a terminal, where they are already on.
		let viewed;
		try {
			viewed = await viewRecipe(file, {
				db,
				scaleFactor,
				bakersReference,
				recipe,
				settings,
				lang: config.language,
				paths: config.paths,
				stock,
				width: Math.min(process.stdout.columns || 70, 78),
				textStyle: terminalTextStyle,
			});
		} catch (err) {
			exitOnError(err);
		}

		reportUnusedStock("gram view", "viewed", stock, [viewed]);

		if (scaleFactor !== 1) {
			const factorStr =
				scaleFactor === Math.round(scaleFactor)
					? `×${scaleFactor}`
					: `×${scaleFactor.toFixed(2)}`;
			console.log(chalk.dim(`  Scaled ${factorStr}\n`));
			for (const w of getScaleWarnings(scaleFactor, viewed.totalMinutes)) {
				log.warn(w);
			}
		}

		await outputPaged(
			viewed.text + missingNutritionNotice(viewed.missingIngredients),
			args["no-pager"] ?? false,
		);
		process.exit(ExitCode.Ok);
	},
});

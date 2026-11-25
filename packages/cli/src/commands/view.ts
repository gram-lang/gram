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
import { openInBrowser } from "../services/printer";
import { startPreviewServer } from "../services/preview-server";
import {
	createPreviewRender,
	PREVIEW_VIEWS,
	previewStrings,
	resolveServeOptions,
	type ServeOptions,
	VIEW_SERVE_ARGS,
} from "../services/view-serve";
import {
	EXPORT_VIEW_SETTINGS,
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
		description:
			"Display a recipe in the terminal, or live in the browser with --serve",
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
		// The run sheet settings too: the live preview has a run sheet tab. The
		// terminal shows the recipe, where they have no effect.
		...viewSettingArgs(EXPORT_VIEW_SETTINGS),
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
		...VIEW_SERVE_ARGS,
	},
	async run({ args, rawArgs }) {
		const file = resolve(args.file as string);
		let serve: ServeOptions | null;
		try {
			serve = resolveServeOptions(args);
		} catch (err) {
			exitOnError(err);
		}
		const config = await loadConfig();
		const dbResult = args["skip-db"] ? null : await loadDbSafe(config, args.db);
		if (dbResult) reportRejectedIngredients(dbResult.rejected, dbResult.dbPath);
		const db = dbResult?.data ?? null;

		if (serve) {
			const bakersReference =
				(args["bakers-reference"] as string) ||
				(args["bakers-math"] ? "" : undefined);
			// Refused here, before the server starts, rather than on every render.
			await resolveScaleArg(
				args.scale as string | undefined,
				file,
				db,
				config.language,
				config.paths,
			);
			await servePreview(file, serve, {
				args,
				rawArgs,
				settings: readViewSettingArgs(args, EXPORT_VIEW_SETTINGS),
				recipe: readRecipeSettingArgs(args),
				bakersReference,
				lang: config.language,
				stock: resolveStockFromConfig(args.stock, config),
			});
			return;
		}

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
			for (const w of getScaleWarnings(
				scaleFactor,
				viewed.totalMinutes,
				viewed.timers,
			)) {
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

/**
 * The live preview: starts the server, opens the browser, and waits for Ctrl+C.
 * Every render reads the config, the database and the recipe again.
 */
async function servePreview(
	file: string,
	serve: ServeOptions,
	options: {
		args: Record<string, unknown>;
		rawArgs: string[] | undefined;
		settings: ReturnType<typeof readViewSettingArgs>;
		recipe: ReturnType<typeof readRecipeSettingArgs>;
		bakersReference: string | undefined;
		lang: string | undefined;
		stock: Set<string> | undefined;
	},
): Promise<void> {
	// The unused --stock entries are reported once, not on every save.
	let reported = false;
	const render = createPreviewRender({
		file,
		args: options.args,
		rawArgs: options.rawArgs,
		settings: options.settings,
		recipe: options.recipe,
		bakersReference: options.bakersReference,
		onPipeline: (result) => {
			if (reported) return;
			reported = true;
			reportUnusedStock("gram view", "viewed", options.stock, [result]);
		},
	});

	let handle: Awaited<ReturnType<typeof startPreviewServer>>;
	try {
		handle = await startPreviewServer({
			views: PREVIEW_VIEWS,
			initialView: serve.view,
			...(serve.port !== undefined && { port: serve.port }),
			render,
			strings: previewStrings(options.lang),
		});
	} catch (err) {
		exitOnError(err);
	}

	const url =
		serve.view === "recipe"
			? handle.url
			: `${handle.url}/?view=${encodeURIComponent(serve.view)}`;
	log.success(`Live preview at ${chalk.cyan(url)}`);
	log.info(chalk.dim("Ctrl+C to stop"));
	if (serve.open) {
		if (!openInBrowser(url)) {
			log.warn(
				`Could not open browser automatically. Open this address manually:\n${url}`,
			);
		}
	}

	await new Promise<void>((resolveStop) => {
		process.once("SIGINT", resolveStop);
		process.once("SIGTERM", resolveStop);
	});
	await handle.close();
	process.exit(ExitCode.Ok);
}

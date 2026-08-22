import { defineCommand } from "citty";
import { resolve } from "node:path";
import { PassThrough } from "node:stream";
import { log, spinner } from "@clack/prompts";
import chalk from "chalk";
import { render } from "ink";
import React from "react";
import { version } from "../../package.json";
import { loadConfig } from "../core/config";
import { loadDbSafe } from "../core/db";
import { runPipeline } from "../core/pipeline";
import { resolveStockFromConfig } from "../core/stock";
import { reportRejectedIngredients } from "../ui/diagnostics";
import { resolveScaleArg, getScaleWarnings } from "../services/scaler";
import { prepareRecipeData } from "../ui/cook/prepare";
import App from "../ui/cook/App";
import { ExitCode, reportError } from "../errors";

export default defineCommand({
	meta: {
		name: "cook",
		version,
		description: "Interactive step-by-step cooking guide for a recipe",
	},
	args: {
		file: {
			type: "positional",
			required: true,
			description: ".gram recipe file to cook",
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
		stock: {
			type: "string",
			description:
				"Comma-separated @use specifiers already on hand for this cook (e.g. @bases/pate.gram,./levain.gram)",
		},
	},
	async run({ args }) {
		const filePath = resolve(args.file as string);
		const config = await loadConfig();
		const dbResult = args["skip-db"] ? null : await loadDbSafe(config, args.db);
		if (dbResult) reportRejectedIngredients(dbResult.rejected, dbResult.dbPath);
		const db = dbResult?.data ?? null;

		const scaleFactor =
			(await resolveScaleArg(
				args.scale as string | undefined,
				filePath,
				db,
				config.language,
				config.paths,
			)) ?? 1;
		const stock = resolveStockFromConfig(args.stock, config);

		const s = spinner();
		s.start("Loading recipe…");

		let recipe;
		let totalTime = 0;
		try {
			const { compiled, analyzed } = await runPipeline(filePath, {
				db,
				skipAnalyzer: !db,
				scaleFactor,
				lang: config.language,
				paths: config.paths,
				stock,
			});
			totalTime = compiled.metrics?.totalTime ?? 0;
			const massMap: Record<string, number> = {};
			for (const item of analyzed?.result?.shopping_list ?? []) {
				if (item.id && typeof item.normalizedMass === "number")
					massMap[item.id] = item.normalizedMass;
			}
			recipe = prepareRecipeData(compiled, massMap);
			const factorStr =
				scaleFactor !== 1
					? ` ${chalk.dim(scaleFactor === Math.round(scaleFactor) ? `(x${scaleFactor})` : `(x${scaleFactor.toFixed(2)})`)}`
					: "";
			s.stop(
				`${recipe.title ?? "Recipe"}${factorStr} — ${recipe.steps.length} step${recipe.steps.length !== 1 ? "s" : ""} ready.`,
			);
		} catch (err) {
			s.stop("Failed.");
			reportError(err);
			process.exit(ExitCode.Error);
		}

		if (recipe.steps.length === 0) {
			log.warn("This recipe has no steps to cook.");
			process.exit(ExitCode.Ok);
		}

		if (scaleFactor !== 1) {
			const warnings = getScaleWarnings(scaleFactor, totalTime);
			for (const w of warnings) log.warn(w);
		}

		if (!process.stdin.isTTY) {
			log.error(
				"gram cook requires an interactive terminal (stdin is not a TTY).",
			);
			process.exit(ExitCode.Error);
		}

		// Bun emits 'data' events on raw-mode stdin instead of 'readable'.
		// ink reads via 'readable' + stream.read(), so bridge through a PassThrough.
		const stdinBridge = new PassThrough();
		(stdinBridge as any).isTTY = true;
		(stdinBridge as any).setRawMode = (mode: boolean) => {
			process.stdin.setRawMode(mode);
		};
		(stdinBridge as any).ref = () => process.stdin.ref();
		(stdinBridge as any).unref = () => process.stdin.unref();
		process.stdin.setRawMode(true);
		process.stdin.resume();
		process.stdin.on("data", (chunk: Buffer) => stdinBridge.write(chunk));

		const { waitUntilExit } = render(React.createElement(App, { recipe }), {
			stdin: stdinBridge as any,
		});
		await waitUntilExit();
		process.stdin.setRawMode(false);
	},
});

import { defineCommand } from "citty";
import { log } from "@clack/prompts";
import chalk from "chalk";
import { resolve } from "node:path";
import { version } from "../../package.json";
import { loadConfig } from "../core/config";
import { loadDbSafe } from "../core/db";
import { buildViewModel } from "../services/viewer";
import { outputRecipe } from "../ui/viewer";
import { resolveScaleArg, getScaleWarnings } from "../services/scaler";
import { ExitCode, GramCLIError } from "../errors";

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
		"bakers-math": {
			type: "boolean",
			description:
				"Display ingredient quantities as a percentage of a reference ingredient (Baker's Percentage).",
		},
		"bakers-reference": {
			type: "string",
			description:
				"Force a specific ingredient as the baker's math reference (e.g. flour). Implies --bakers-math",
		},
		"bakers-math-only": {
			type: "boolean",
			description: "Only show the percentages and hide absolute weights.",
		},
	},
	async run({ args }) {
		const file = resolve(args.file as string);
		const config = await loadConfig();
		const db = args["skip-db"] ? null : await loadDbSafe(config, args.db);

		const scaleFactor =
			(await resolveScaleArg(args.scale as string | undefined, file, db)) ?? 1;

		const bakersReference =
			(args["bakers-reference"] as string) ||
			(args["bakers-math"] ? "" : undefined);
		const bakersMathOnly = args["bakers-math-only"] as boolean;

		let model;
		try {
			model = await buildViewModel(file, {
				db,
				scaleFactor,
				bakersReference,
				bakersMathOnly,
			});
		} catch (err) {
			if (err instanceof GramCLIError) {
				log.error(err.message);
				process.exit(err.exitCode);
			}
			throw err;
		}

		if (scaleFactor !== 1) {
			const factorStr =
				scaleFactor === Math.round(scaleFactor)
					? `×${scaleFactor}`
					: `×${scaleFactor.toFixed(2)}`;
			console.log(chalk.dim(`  Scaled ${factorStr}\n`));
			const warnings = getScaleWarnings(scaleFactor, model.times?.total ?? 0);
			for (const w of warnings) log.warn(w);
		}

		await outputRecipe(model, args["no-pager"] ?? false);
		process.exit(ExitCode.Ok);
	},
});

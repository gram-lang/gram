import { defineCommand } from "citty";
import { resolve } from "node:path";
import { log } from "@clack/prompts";
import chalk from "chalk";
import { loadConfig } from "../core/config";
import { loadDbSafe } from "../core/db";
import { resolveScaleArg } from "../services/scaler";
import { generatePrintHTML, openInBrowser } from "../services/printer";
import { reportRejectedIngredients } from "../ui/diagnostics";
import {
	NUTRITION_BASIS_FLAG_DESCRIPTION,
	parseNutritionBasis,
} from "../services/nutrition-basis";
import { GramCLIError } from "../errors";

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
		"step-qty": {
			type: "boolean",
			description:
				"Show ingredient quantities in step text (pass --no-step-qty to hide; quantities in section mise en place are always shown)",
			default: true,
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
		nutrition: {
			type: "string",
			description: NUTRITION_BASIS_FLAG_DESCRIPTION,
		},
	},
	async run({ args }) {
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
		);

		const bakersReference =
			(args["bakers-reference"] as string) ||
			(args["bakers-math"] ? "" : undefined);
		const bakersMathOnly = args["bakers-math-only"] as boolean;
		const nutritionBasis = parseNutritionBasis(args.nutrition);

		let htmlPath: string;
		try {
			htmlPath = await generatePrintHTML(filePath, db, scaleFactor, {
				hideStepQty: !args["step-qty"],
				bakersReference,
				bakersMathOnly,
				nutritionBasis,
				lang: config.language,
			});
		} catch (err) {
			if (err instanceof GramCLIError) {
				log.error(err.message);
				process.exit(err.exitCode);
			}
			throw err;
		}

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

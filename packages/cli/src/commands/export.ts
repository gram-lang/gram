import { defineCommand } from "citty";
import { writeFile } from "node:fs/promises";
import { resolve, join, dirname, basename, extname } from "node:path";
import { log } from "@clack/prompts";
import chalk from "chalk";
import { loadConfig } from "../core/config";
import { loadDbSafe } from "../core/db";
import { resolveScaleArg } from "../services/scaler";
import { exportRecipe } from "../services/exporter";
import { reportRejectedIngredients } from "../ui/diagnostics";
import { ExitCode, GramCLIError } from "../errors";

export default defineCommand({
	meta: {
		name: "export",
		description: "Export a recipe to Markdown or print-ready HTML",
	},
	args: {
		file: {
			type: "positional",
			required: true,
			description: "Path to a .gram recipe file",
		},
		format: {
			type: "string",
			description: "Output format: md (Markdown) or html (print-ready A4 HTML)",
		},
		output: {
			type: "string",
			alias: "o",
			description:
				"Output file path (default: same directory as input, with new extension)",
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
				"HTML only: show ingredient quantities in step text (pass --no-step-qty to hide; quantities in section mise en place are always shown)",
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
	},
	async run({ args }) {
		const fmt = args.format as string | undefined;
		if (!fmt || (fmt !== "md" && fmt !== "html")) {
			log.error("--format is required. Use --format md or --format html.");
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
		);

		const bakersReference =
			(args["bakers-reference"] as string) ||
			(args["bakers-math"] ? "" : undefined);
		const bakersMathOnly = args["bakers-math-only"] as boolean;

		const outputPath = args.output
			? resolve(args.output as string)
			: join(
					dirname(filePath),
					`${basename(filePath, extname(filePath))}.${fmt}`,
				);

		let content: string;

		try {
			content = await exportRecipe(filePath, fmt, db, scaleFactor, {
				hideStepQty: !args["step-qty"],
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

		await writeFile(outputPath, content, "utf-8");
		log.success(`Exported to ${chalk.dim(outputPath)}`);
	},
});

import { defineCommand } from "citty";
import { log, spinner, confirm, isCancel, cancel } from "@clack/prompts";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { version } from "../../package.json";
import { importWithAI } from "../services/importer";
import { renderImportResult } from "../ui/importer";
import { loadConfig } from "../core/config";
import { loadAiModel } from "../core/ai";
import { ExitCode, GramCLIError } from "../errors";

export default defineCommand({
	meta: {
		name: "import",
		version,
		description:
			"Import a recipe from a JSON-LD file or URL and convert it to .gram via AI",
	},
	args: {
		source: {
			type: "positional",
			required: true,
			description: "Local JSON-LD file or HTTP(S) URL",
		},
		output: {
			type: "string",
			alias: "o",
			description: "Output .gram file (default: stdout)",
		},
		yes: {
			type: "boolean",
			alias: "y",
			description:
				"Skip the review prompt and write the file directly (for scripting)",
			default: false,
		},
	},
	async run({ args }) {
		const source = args.source as string;
		const outputPath = args.output ? resolve(args.output) : undefined;

		const config = await loadConfig();

		let model;
		try {
			model = loadAiModel(config);
		} catch (err) {
			if (err instanceof GramCLIError) {
				log.error(err.message);
				process.exit(err.exitCode);
			}
			throw err;
		}

		const s = spinner();
		s.start("Importing recipe via AI…");

		let result;
		try {
			result = await importWithAI(source, model, config.language);
			s.stop("Import complete.");
		} catch (err) {
			s.stop("Import failed.");
			if (err instanceof GramCLIError) {
				log.error(err.message);
				process.exit(err.exitCode);
			}
			throw err;
		}

		if (outputPath) {
			// `result.gramContent` was produced by an AI model from content fetched from
			// an external, untrusted source (a scraped web page or a local JSON-LD file).
			// validateGram() only checks that it's syntactically valid .gram — it says
			// nothing about whether the quantities/ingredients/steps are faithful to the
			// source. Review before writing, unless explicitly skipped for scripting.
			if (!args.yes) {
				log.message(result.gramContent, { symbol: "·" });
				const proceed = await confirm({
					message: `Write this AI-converted recipe (from an untrusted external source) to ${outputPath}?`,
					initialValue: true,
				});
				if (isCancel(proceed) || !proceed) {
					cancel("Import canceled — nothing was written.");
					process.exit(ExitCode.Ok);
				}
			}
			await writeFile(outputPath, result.gramContent, "utf-8");
			renderImportResult(result, source, outputPath);
		} else {
			process.stderr.write("\n");
			process.stderr.write(`  ${"Title".padEnd(14)} ${result.title}\n`);
			process.stderr.write(
				`  ${"Ingredients".padEnd(14)} ${result.ingredientCount}\n`,
			);
			process.stderr.write(`  ${"Steps".padEnd(14)} ${result.stepCount}\n`);
			if (result.parseWarnings.length > 0) {
				process.stderr.write(`\n  ⚠ Warnings:\n`);
				for (const w of result.parseWarnings) {
					process.stderr.write(`    ${w}\n`);
				}
			}
			process.stderr.write("\n");
			process.stdout.write(`${result.gramContent}\n`);
		}

		process.exit(ExitCode.Ok);
	},
});

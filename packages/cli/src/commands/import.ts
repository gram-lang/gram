import { defineCommand } from "citty";
import { log, spinner, confirm, isCancel, cancel } from "@clack/prompts";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { version } from "../../package.json";
import { importWithAI } from "../services/importer";
import { renderImportResult } from "../ui/importer";
import { loadConfig } from "../core/config";
import { AI_ARGS } from "../core/ai-args";
import { canPrompt } from "../core/interactive";
import { resolveAiForCommand } from "../ui/ai-model";
import { ExitCode, GramCLIError } from "../errors";

export default defineCommand({
	meta: {
		name: "import",
		version,
		description:
			"Import a recipe from a JSON-LD file or URL and convert it to .gram via AI",
	},
	args: {
		...AI_ARGS,
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

		const { model } = await resolveAiForCommand(config, args);

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
			//
			// The canPrompt() guard is not cosmetic: without it, a scripted run with
			// --output and no --yes rendered the prompt and then blocked forever on
			// stdin. `db enrich` and `db lint` already checked; import didn't. Say so
			// out loud rather than quietly dropping the review — the point of the
			// prompt is that nobody has vouched for this content yet.
			if (!args.yes) {
				if (canPrompt()) {
					log.message(result.gramContent, { symbol: "·" });
					const proceed = await confirm({
						message: `Write this AI-converted recipe (from an untrusted external source) to ${outputPath}?`,
						initialValue: true,
					});
					if (isCancel(proceed) || !proceed) {
						cancel("Import canceled — nothing was written.");
						process.exit(ExitCode.Ok);
					}
				} else {
					log.warn(
						"Non-interactive mode detected — writing without review. Run `gram check` on the result.",
					);
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

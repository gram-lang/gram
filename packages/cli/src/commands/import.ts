import { defineCommand } from "citty";
import { log, spinner, confirm, isCancel, cancel } from "@clack/prompts";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { version } from "../../package.json";
import { importWithAI } from "../services/importer";
import { renderImportResult, renderImportProblems } from "../ui/importer";
import { loadConfig } from "../core/config";
import { loadDb } from "../core/db";
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
		force: {
			type: "boolean",
			description:
				"Emit the recipe even if the import lost content or left errors unfixed",
			default: false,
		},
	},
	async run({ args }) {
		const source = args.source as string;
		const outputPath = args.output ? resolve(args.output) : undefined;

		const config = await loadConfig();

		// Without --output the recipe *is* stdout, so every piece of chrome — the
		// status line, the spinner, the diagnostics — has to go to stderr instead.
		// `gram import x.json > recipe.gram` used to capture the spinner frames
		// into the .gram file.
		const chrome = outputPath ? undefined : process.stderr;

		const { model } = await resolveAiForCommand(config, args, chrome);

		// Optional: with no database there is simply no analyzer report. Import
		// is often the very first thing a user runs, before `gram db sync`, so a
		// missing database must not be an error here.
		const db = (await loadDb(config).catch(() => null))?.data ?? null;

		const s = spinner({ output: chrome });
		s.start("Importing recipe via AI…");

		let result;
		try {
			result = await importWithAI(source, model, {
				lang: config.language,
				db,
			});
			s.stop("Import complete.");
		} catch (err) {
			s.stop("Import failed.");
			if (err instanceof GramCLIError) {
				log.error(err.message, { output: chrome });
				process.exit(err.exitCode);
			}
			throw err;
		}

		// Two failures the AI cannot be trusted to have noticed: content that
		// never reached the compiler, and errors its own repair loop gave up on.
		// Neither used to stop anything — a file missing four ingredients was
		// written with a clean exit code. Nothing is emitted now unless asked.
		const broken =
			result.lostIngredients.length > 0 || result.unresolvedErrors.length > 0;
		if (broken) {
			renderImportProblems(result, chrome);
			if (!args.force) {
				log.error(
					"Import refused — the result is incomplete or invalid. Re-run with --force to write it anyway, or with a different --model.",
					{ output: chrome },
				);
				process.exit(ExitCode.Error);
			}
			log.warn("--force given — emitting an incomplete or invalid recipe.", {
				output: chrome,
			});
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
			// Same summary as the --output path, on stderr, so the two can't drift
			// apart — the hand-rolled copy that used to live here had already
			// fallen behind on the analyzer report.
			renderImportResult(result, source, undefined, chrome);
			process.stdout.write(`${result.gramContent}\n`);
		}

		process.exit(ExitCode.Ok);
	},
});

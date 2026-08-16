import { defineCommand } from "citty";
import { log, spinner, confirm, isCancel, cancel } from "@clack/prompts";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { version } from "../../package.json";
import { importWithAI, importVideoWithAI } from "../services/importer";
import {
	DEFAULT_MAX_DURATION_MINUTES,
	estimateVideoTokens,
	fetchYoutubeMetadata,
	formatDuration,
	parseYoutubeUrl,
	type YoutubeMetadata,
} from "../services/youtube";
import { renderImportResult, renderImportProblems } from "../ui/importer";
import { loadConfig } from "../core/config";
import { loadDb } from "../core/db";
import { AI_ARGS } from "../core/ai-args";
import { canPrompt } from "../core/interactive";
import { resolveAiForCommand } from "../ui/ai-model";
import type { AiProvider } from "../types";
import { ExitCode, GramCLIError } from "../errors";

/**
 * Everything that happens before a single token is spent on a video: fetch the
 * metadata, refuse anything over the cap, and show what it will cost.
 *
 * A video is billed by the second — a 26-minute one was 41% of the entire
 * spike's token usage on its own. The cap is the guardrail; the estimate is so
 * the user can decide when they are under it.
 */
async function prepareVideoImport(
	source: string,
	args: { "max-duration"?: string; yes?: boolean },
	provider: AiProvider,
	chrome: NodeJS.WriteStream | undefined,
): Promise<YoutubeMetadata> {
	// Only Google declares YouTube URLs as pass-through (`supportedUrls`). With
	// any other provider the SDK does not error — it *fetches* the URL and
	// inlines the bytes, so the model receives the watch page's HTML labelled
	// as video/mp4 and hallucinates a recipe from nothing. Fail loudly instead.
	if (provider !== "google") {
		log.error(
			`Video import needs the Google provider (Gemini reads YouTube directly); this run is using "${provider}". Add --provider google, or pass a written recipe URL instead.`,
			{ output: chrome },
		);
		process.exit(ExitCode.Error);
	}

	let meta: YoutubeMetadata;
	try {
		meta = await fetchYoutubeMetadata(source);
	} catch (err) {
		if (err instanceof GramCLIError) {
			log.error(err.message, { output: chrome });
			process.exit(err.exitCode);
		}
		throw err;
	}

	const maxMinutes = args["max-duration"]
		? Number(args["max-duration"])
		: DEFAULT_MAX_DURATION_MINUTES;
	if (!Number.isFinite(maxMinutes) || maxMinutes <= 0) {
		log.error(
			`--max-duration must be a positive number of minutes, got "${args["max-duration"]}".`,
			{ output: chrome },
		);
		process.exit(ExitCode.Error);
	}

	if (meta.durationSeconds === undefined) {
		// Duration needs the YouTube Data API. Without it the run still works,
		// it just can't be priced or capped — so say so instead of pretending.
		log.warn(
			"Video duration unknown (set YOUTUBE_API_KEY to enable the length cap and cost estimate). A long video can be expensive.",
			{ output: chrome },
		);
	} else {
		const tokens = estimateVideoTokens(meta.durationSeconds);
		log.step(
			`${formatDuration(meta.durationSeconds)} of video ≈ ${Math.round(tokens / 1000)}k input tokens${meta.title ? ` — ${meta.title}` : ""}`,
			{ output: chrome },
		);
		if (meta.durationSeconds > maxMinutes * 60) {
			log.error(
				`Video is ${formatDuration(meta.durationSeconds)}, over the ${maxMinutes}-minute limit. Raise it with --max-duration ${Math.ceil(meta.durationSeconds / 60)}.`,
				{ output: chrome },
			);
			process.exit(ExitCode.Error);
		}
	}

	if (!args.yes && canPrompt()) {
		const proceed = await confirm({
			message: "Send this video to the AI model?",
			initialValue: true,
		});
		if (isCancel(proceed) || !proceed) {
			cancel("Import canceled — nothing was sent.");
			process.exit(ExitCode.Ok);
		}
	}

	return meta;
}

export default defineCommand({
	meta: {
		name: "import",
		version,
		description:
			"Import a recipe from a JSON-LD file, a web page or a YouTube video, and convert it to .gram via AI",
	},
	args: {
		...AI_ARGS,
		source: {
			type: "positional",
			required: true,
			description: "Local JSON-LD file, HTTP(S) URL, or YouTube video URL",
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
		"max-duration": {
			type: "string",
			description: `Refuse a video longer than this many minutes (default: ${DEFAULT_MAX_DURATION_MINUTES})`,
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

		const { model, selection } = await resolveAiForCommand(
			config,
			args,
			chrome,
		);

		// Optional: with no database there is simply no analyzer report. Import
		// is often the very first thing a user runs, before `gram db sync`, so a
		// missing database must not be an error here.
		const db = (await loadDb(config).catch(() => null))?.data ?? null;

		// A YouTube URL is read as video, not scraped for JSON-LD — a watch page
		// carries VideoObject markup, never a Recipe.
		const videoMeta = parseYoutubeUrl(source)
			? await prepareVideoImport(source, args, selection.provider, chrome)
			: undefined;

		const s = spinner({ output: chrome });
		s.start(
			videoMeta ? "Watching the video via AI…" : "Importing recipe via AI…",
		);

		let result;
		try {
			result = videoMeta
				? await importVideoWithAI(videoMeta, model, {
						lang: config.language,
						db,
					})
				: await importWithAI(source, model, {
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

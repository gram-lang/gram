import { log, confirm, isCancel, cancel } from "@clack/prompts";
import type { Writable } from "node:stream";
import {
	DEFAULT_MAX_DURATION_MINUTES,
	estimateVideoTokens,
	fetchYoutubeMetadata,
	formatDuration,
	type YoutubeMetadata,
} from "../services/youtube";
import { canPrompt } from "../core/interactive";
import type { AiProvider } from "../types";
import { ExitCode, GramCLIError } from "../errors";

/**
 * Everything that happens before a single token is spent on a video: fetch
 * the metadata, refuse anything over the cap, and show what it will cost.
 *
 * Lives alongside `resolveAiForCommand` in `ui/` rather than in
 * `services/youtube.ts` — it prompts, prints, and calls `process.exit`, which
 * `services/youtube.ts` deliberately does not: that module is the pure fetch
 * layer, this is the interactive layer wrapping it, same split as
 * `core/ai.ts` (pure) / `ui/ai-model.ts` (interactive).
 *
 * A video is billed by the second — a 26-minute one was 41% of the entire
 * spike's token usage on its own. The cap is the guardrail; the estimate is so
 * the user can decide when they are under it.
 */
export async function prepareVideoImport(
	source: string,
	args: { "max-duration"?: string; yes?: boolean },
	provider: AiProvider,
	chrome: Writable | undefined,
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

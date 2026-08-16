import { GramCLIError, ExitCode } from "../errors";
import { fetchTextWithSsrfGuard } from "../core/http";
import { splitDuration } from "../core/format";

/**
 * YouTube is read multimodally: the video URL is handed to Gemini, which
 * watches it. There is no transcript step — no official API exposes captions
 * for videos you don't own (`captions.download` requires the owner's OAuth),
 * and everything else is reverse-engineered InnerTube with no stability
 * guarantee.
 */

/** A video ID is `[A-Za-z0-9_-]`; the length bound is a sanity check, not a spec. */
const VIDEO_ID = /^[\w-]{5,64}$/;

/**
 * Normalise any YouTube URL to `https://www.youtube.com/watch?v=ID`.
 *
 * This is functional, not cosmetic. @ai-sdk/google only passes a URL straight
 * through to Gemini as `fileData.fileUri` when it matches
 * `^https://(?:www\.)?youtube\.com/watch\?v=[\w-]+…$` or a `youtu.be` link.
 * A `/shorts/` URL fails that test, so the SDK would try to *download* the
 * video and inline it — which is not what we want, and mostly does not work.
 *
 * Returns null for anything that is not a YouTube video URL.
 */
export function parseYoutubeUrl(
	input: string,
): { videoId: string; canonicalUrl: string } | null {
	let url: URL;
	try {
		url = new URL(input);
	} catch {
		return null;
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") return null;

	const host = url.hostname.replace(/^www\./, "").toLowerCase();
	let id: string | null = null;

	if (host === "youtu.be") {
		id = url.pathname.slice(1);
	} else if (host === "youtube.com" || host === "m.youtube.com") {
		if (url.pathname === "/watch") {
			id = url.searchParams.get("v");
		} else {
			// /shorts/ID, /embed/ID, /live/ID, /v/ID
			const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/]+)/);
			id = m?.[1] ?? null;
		}
	}

	if (!id || !VIDEO_ID.test(id)) return null;
	return { videoId: id, canonicalUrl: `https://www.youtube.com/watch?v=${id}` };
}

export interface YoutubeMetadata {
	videoId: string;
	canonicalUrl: string;
	title?: string;
	author?: string;
	/** Only known when YOUTUBE_API_KEY is set — oEmbed does not report it. */
	durationSeconds?: number;
}

/**
 * Title and channel, from the public oEmbed endpoint. No key, no quota.
 *
 * Both fields are attacker-controlled text (anyone can name a video anything),
 * so they are treated as data everywhere downstream — see prompts/video-import.
 */
async function fetchOembed(
	canonicalUrl: string,
): Promise<{ title?: string; author?: string }> {
	const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`;
	try {
		const { body } = await fetchTextWithSsrfGuard(endpoint);
		const data = JSON.parse(body) as { title?: unknown; author_name?: unknown };
		return {
			title: typeof data.title === "string" ? data.title : undefined,
			author:
				typeof data.author_name === "string" ? data.author_name : undefined,
		};
	} catch {
		// A private, deleted or region-blocked video 404s here. Not fatal on its
		// own — the model may still be refused by Gemini, with a clearer error.
		return {};
	}
}

/** ISO 8601 duration as YouTube reports it: PT#H#M#S. */
export function parseIso8601Duration(value: string): number | null {
	const m = value.match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
	if (!m) return null;
	const [, d, h, min, s] = m;
	return (
		Number(d ?? 0) * 86400 +
		Number(h ?? 0) * 3600 +
		Number(min ?? 0) * 60 +
		Number(s ?? 0)
	);
}

/**
 * Duration, via YouTube Data API v3 — one quota unit, a plain API key.
 *
 * Optional on purpose: without `YOUTUBE_API_KEY` the import still works, it
 * just cannot tell you what the video will cost before spending it.
 */
async function fetchDuration(videoId: string): Promise<number | undefined> {
	const key = process.env.YOUTUBE_API_KEY;
	if (!key) return undefined;

	const endpoint = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(key)}`;
	try {
		const { body } = await fetchTextWithSsrfGuard(endpoint);
		const data = JSON.parse(body) as {
			items?: { contentDetails?: { duration?: string } }[];
		};
		const iso = data.items?.[0]?.contentDetails?.duration;
		return iso ? (parseIso8601Duration(iso) ?? undefined) : undefined;
	} catch {
		return undefined;
	}
}

export async function fetchYoutubeMetadata(
	input: string,
): Promise<YoutubeMetadata> {
	const parsed = parseYoutubeUrl(input);
	if (!parsed) {
		throw new GramCLIError(`Not a YouTube video URL: ${input}`, ExitCode.Error);
	}
	const [oembed, durationSeconds] = await Promise.all([
		fetchOembed(parsed.canonicalUrl),
		fetchDuration(parsed.videoId),
	]);
	return { ...parsed, ...oembed, durationSeconds };
}

/**
 * Gemini bills video at roughly 100 tokens per second at
 * MEDIA_RESOLUTION_LOW — the figure the spike measured across six videos
 * (a Short ≈ 3–5k, ten minutes ≈ 60k, twenty-six minutes ≈ 158k).
 *
 * The single place that knows this number: both the estimate shown to the user
 * and the duration cap are derived from it, so they cannot disagree.
 */
export const VIDEO_TOKENS_PER_SECOND = 100;

/** Default ceiling. One 26-minute video was 41% of the entire spike's tokens. */
export const DEFAULT_MAX_DURATION_MINUTES = 20;

export function estimateVideoTokens(durationSeconds: number): number {
	return Math.round(durationSeconds * VIDEO_TOKENS_PER_SECOND);
}

export function formatDuration(seconds: number): string {
	const { h, m, s } = splitDuration(seconds);
	const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
	return h > 0
		? `${h}:${mm}:${String(s).padStart(2, "0")}`
		: `${mm}:${String(s).padStart(2, "0")}`;
}

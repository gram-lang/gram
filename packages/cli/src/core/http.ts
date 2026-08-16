import { GramCLIError, ExitCode } from "../errors";
import { assertPublicUrl } from "./ssrf";

/**
 * The one way this CLI reaches the network.
 *
 * Extracted from `services/importer.ts` when a second caller appeared (YouTube
 * metadata). Everything outbound goes through `assertPublicUrl` and the size
 * cap here — a new fetch written by hand elsewhere would be a new hole.
 */

export const FETCH_TIMEOUT_MS = 15_000;
/** 10 MB — a recipe page is never legitimately bigger than this. */
export const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 5;

// `redirect: "manual"` + a manual loop, re-running `assertPublicUrl` on
// every hop, instead of leaving redirects to `fetch`'s default behavior — a URL
// that's public on the first request can still redirect (or DNS-rebind) to an
// internal address, and a check done only once up front would never see that.
async function fetchWithSsrfGuard(url: string): Promise<Response> {
	let currentUrl = url;
	for (let i = 0; i <= MAX_REDIRECTS; i++) {
		await assertPublicUrl(currentUrl);
		const res = await fetch(currentUrl, {
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			redirect: "manual",
		});
		if (res.status >= 300 && res.status < 400) {
			const location = res.headers.get("location");
			if (!location) {
				throw new GramCLIError(
					`Redirect from ${currentUrl} had no Location header.`,
					ExitCode.Error,
				);
			}
			currentUrl = new URL(location, currentUrl).toString();
			continue;
		}
		return res;
	}
	throw new GramCLIError(
		`Too many redirects (> ${MAX_REDIRECTS}) fetching ${url}.`,
		ExitCode.Error,
	);
}

// Reads a response body with a hard size cap, regardless of what Content-Length
// claims (it can be absent or wrong) — protects against a slow/huge/malicious
// response tying up the CLI indefinitely or exhausting memory.
async function readBodyWithLimit(res: Response): Promise<string> {
	const reader = res.body?.getReader();
	if (!reader) return res.text();

	const decoder = new TextDecoder();
	let result = "";
	let received = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		received += value.byteLength;
		if (received > MAX_RESPONSE_BYTES) {
			await reader.cancel();
			throw new GramCLIError(
				`Response exceeds the ${MAX_RESPONSE_BYTES / (1024 * 1024)}MB limit.`,
				ExitCode.Error,
			);
		}
		result += decoder.decode(value, { stream: true });
	}
	result += decoder.decode();
	return result;
}

/** Guarded fetch + capped read + a friendly message on timeout. */
export async function fetchTextWithSsrfGuard(
	url: string,
): Promise<{ body: string; contentType: string }> {
	try {
		const res = await fetchWithSsrfGuard(url);
		if (!res.ok) {
			throw new GramCLIError(
				`HTTP ${res.status} fetching ${url}`,
				ExitCode.Error,
			);
		}
		// The same AbortSignal covers both the connection and the body read (per
		// the fetch spec, an in-flight body read aborts too), so both have to sit
		// inside this try — otherwise a timeout firing mid-read leaks the raw
		// "TimeoutError" instead of the message below.
		return {
			body: await readBodyWithLimit(res),
			contentType: res.headers.get("content-type") ?? "",
		};
	} catch (err) {
		if (err instanceof Error && err.name === "TimeoutError") {
			throw new GramCLIError(
				`Timed out fetching ${url} after ${FETCH_TIMEOUT_MS / 1000}s.`,
				ExitCode.Error,
			);
		}
		throw err;
	}
}

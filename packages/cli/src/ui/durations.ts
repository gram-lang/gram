import { formatDuration } from "@gram-lang/renderer";

/**
 * A change of duration, signed: `+1h 30m`, `-45m`. The words come from the
 * renderer's `formatDuration`, so the CLI reads like the views; only the sign
 * is the CLI's. No change is `0m`, as the renderer writes it.
 */
export function formatDurationDelta(minutes: number): string {
	const magnitude = formatDuration(Math.abs(minutes));
	if (magnitude === "0m") return magnitude;
	return `${minutes < 0 ? "-" : "+"}${magnitude}`;
}

/**
 * Time elapsed in a cooking session, from milliseconds. Rounded to the minute:
 * seconds are noise after forty minutes in the kitchen. Under a minute the
 * seconds stay, so a very short session never reads `0m`.
 */
export function formatElapsed(ms: number): string {
	const minutes = ms / 60_000;
	return formatDuration(minutes < 1 ? minutes : Math.round(minutes));
}

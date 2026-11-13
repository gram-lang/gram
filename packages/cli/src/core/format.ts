import { formatNumber } from "@gram-lang/i18n";

/**
 * A number as the CLI shows it: in the project's language (`lang`, its
 * `language` setting) when the output speaks it, else in English, like the
 * messages around it; no thousands separator, as a recipe writes `1500 g`.
 * The same rule as the renderer's views (`formatNumber` of `@gram-lang/i18n`).
 */
export function fmtNumber(n: number, maxDecimals = 2, lang?: string): string {
	return formatNumber(n, lang, maxDecimals);
}

/**
 * Decomposes a whole number of seconds into hours/minutes/seconds. Shared by
 * every clock-style duration display in the CLI (the cook-mode countdown,
 * the video-import length estimate) — each has its own rounding and padding
 * rules, but the h/m/s split underneath is the same arithmetic.
 */
export function splitDuration(totalSeconds: number): {
	h: number;
	m: number;
	s: number;
} {
	const total = Math.max(0, Math.floor(totalSeconds));
	return {
		h: Math.floor(total / 3600),
		m: Math.floor((total % 3600) / 60),
		s: total % 60,
	};
}

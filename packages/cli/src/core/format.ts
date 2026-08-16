const systemLocale =
	typeof Intl !== "undefined"
		? Intl.DateTimeFormat().resolvedOptions().locale
		: "en";

export function fmtNumber(n: number, maxDecimals = 2): string {
	return new Intl.NumberFormat(systemLocale, {
		maximumFractionDigits: maxDecimals,
	}).format(n);
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

/**
 * Safe wrapper for Umami analytics.
 * Ensures that if the Umami script is blocked by an adblocker,
 * the site does not throw JavaScript errors.
 */

declare global {
	interface Window {
		umami?: {
			track: (eventName: string, eventData?: Record<string, unknown>) => void;
		};
	}
}

export function trackEvent(
	eventName: string,
	eventData?: Record<string, unknown>,
) {
	if (typeof window === "undefined" || !window.umami) return;
	try {
		window.umami.track(eventName, eventData);
	} catch {
		// Silently fail if tracking fails
	}
}

/** Delays invoking `fn` until `delayMs` have passed without another call. */
export function debounce<Args extends unknown[]>(
	fn: (...args: Args) => void,
	delayMs: number,
) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	return (...args: Args) => {
		clearTimeout(timer);
		timer = setTimeout(() => fn(...args), delayMs);
	};
}

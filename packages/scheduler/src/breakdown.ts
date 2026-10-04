import type { MiseEnPlaceItem, TimeBreakdownItem } from "./types";

/**
 * Adds `duration` minutes to the entry labelled `label`, creating it when
 * missing. Non-positive durations are ignored. Searches the full list rather
 * than only its tail, so an entry touched again later still accumulates.
 */
export const addToBreakdown = (
	breakdown: TimeBreakdownItem[],
	label: string,
	duration: number,
): void => {
	if (duration <= 0) return;
	const existing = breakdown.find((b) => b.label === label);
	if (existing) {
		existing.duration += duration;
	} else {
		breakdown.push({ label, duration });
	}
};

export const sumDuration = (items: MiseEnPlaceItem[]): number =>
	items.reduce((total, item) => total + item.duration, 0);

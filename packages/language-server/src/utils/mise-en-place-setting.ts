import type { ScheduleMode } from "@gram-lang/renderer";

/** Preparation right before each section, unless the reader picks otherwise. */
export const DEFAULT_MISE_EN_PLACE: ScheduleMode = "perSection";

/**
 * Reads `gram.miseEnPlace` out of whatever `getConfiguration("gram")` hands
 * back. Anything that isn't one of the two known values — a missing key, a
 * typo, a client that returned nothing — falls back to the default, so a bad
 * setting can never blank the preview.
 */
export function parseMiseEnPlaceSetting(config: unknown): ScheduleMode {
	const value = (config as { miseEnPlace?: unknown } | null | undefined)
		?.miseEnPlace;
	return value === "upfront" || value === "perSection"
		? value
		: DEFAULT_MISE_EN_PLACE;
}

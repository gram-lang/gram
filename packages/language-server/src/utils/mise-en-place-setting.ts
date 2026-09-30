import {
	DEFAULT_SCHEDULE_MODE,
	type ScheduleMode,
	isScheduleMode,
} from "@gram-lang/kitchen";

/**
 * Reads `gram.miseEnPlace` out of whatever `getConfiguration("gram")` hands
 * back. Anything that isn't one of the two known values — a missing key, a
 * typo, a client that returned nothing — falls back to the default, so a bad
 * setting can never blank the preview.
 */
export function parseMiseEnPlaceSetting(config: unknown): ScheduleMode {
	const value = (config as { miseEnPlace?: unknown } | null | undefined)
		?.miseEnPlace;
	return isScheduleMode(value) ? value : DEFAULT_SCHEDULE_MODE;
}

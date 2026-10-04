import {
	DEFAULT_MISE_EN_PLACE_MODE,
	DEFAULT_REST_CHOICE,
	type MiseEnPlaceMode,
	type RestChoice,
	isMiseEnPlaceMode,
	isRestChoice,
} from "@gram-lang/kitchen";

/**
 * Reads `gram.miseEnPlace` out of whatever `getConfiguration("gram")` hands
 * back. Anything that isn't a known schedule mode — a missing key, a
 * typo, a client that returned nothing — falls back to the default, so a bad
 * setting can never blank the preview.
 */
export function parseMiseEnPlaceSetting(config: unknown): MiseEnPlaceMode {
	const value = (config as { miseEnPlace?: unknown } | null | undefined)
		?.miseEnPlace;
	return isMiseEnPlaceMode(value) ? value : DEFAULT_MISE_EN_PLACE_MODE;
}

/**
 * Reads `gram.rests` the same way: how long a rest written as a range lasts.
 * Anything unknown falls back on the shortest, so a bad setting never blanks
 * the preview.
 */
export function parseRestsSetting(config: unknown): RestChoice {
	const value = (config as { rests?: unknown } | null | undefined)?.rests;
	return isRestChoice(value) ? value : DEFAULT_REST_CHOICE;
}

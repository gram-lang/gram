import {
	DEFAULT_MISE_EN_PLACE_MODE,
	type MiseEnPlaceMode,
	isMiseEnPlaceMode,
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

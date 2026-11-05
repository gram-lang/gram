import type { MiseEnPlaceMode } from "@gram-lang/kitchen";
import { VIEW_SETTINGS } from "@gram-lang/renderer";
import { flagDefault, flagValues, parseChoiceFlag } from "./setting-flags";

const SETTING = VIEW_SETTINGS.miseEnPlace;

/** `per-section`, `upfront`, `per-day`: kebab-case on the command line, camelCase everywhere else. */
export const MISE_EN_PLACE_FLAG_VALUES = flagValues(SETTING);

export const MISE_EN_PLACE_FLAG_DESCRIPTION = `When the mise en place is planned: ${MISE_EN_PLACE_FLAG_VALUES.join(" | ")} (default: ${flagDefault(SETTING)} — right before each section; upfront — all at the start; per-day — at the start of each working day). Changes the total and idle times.`;

/** Reports and exits on an unusable value, like every setting flag. */
export function parseMiseEnPlace(value: unknown): MiseEnPlaceMode | undefined {
	return parseChoiceFlag(SETTING, "mise-en-place", value);
}

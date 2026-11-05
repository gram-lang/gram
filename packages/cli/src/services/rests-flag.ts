import type { RestChoice } from "@gram-lang/kitchen";
import { VIEW_SETTINGS } from "@gram-lang/renderer";
import {
	flagDefault,
	flagValueList,
	flagValues,
	parseChoiceFlag,
} from "./setting-flags";

const SETTING = VIEW_SETTINGS.rests;

export const RESTS_FLAG_VALUES: readonly string[] = flagValues(SETTING);

export const RESTS_FLAG_DESCRIPTION = `How long a rest written as a range (~_{12-24h}) lasts: ${flagValueList(SETTING)} (default: ${flagDefault(SETTING)}). An exact rest and an active timer are not affected. Changes the total and idle times.`;

/** Reports and exits on an unusable value, like every setting flag. */
export function parseRests(value: unknown): RestChoice | undefined {
	return parseChoiceFlag(SETTING, "rests", value);
}

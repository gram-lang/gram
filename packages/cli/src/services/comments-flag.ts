import { type CommentsMode, VIEW_SETTINGS } from "@gram-lang/renderer";
import {
	flagDefault,
	flagValueList,
	flagValues,
	parseChoiceFlag,
} from "./setting-flags";

const SETTING = VIEW_SETTINGS.comments;

export const COMMENTS_FLAG_VALUES: readonly string[] = flagValues(SETTING);

export const COMMENTS_FLAG_DESCRIPTION = `Whether to show the comments of the recipe (// like this): ${flagValueList(SETTING)} (default: ${flagDefault(SETTING)}).`;

/** Reports and exits on an unusable value, like every setting flag. */
export function parseComments(value: unknown): CommentsMode | undefined {
	return parseChoiceFlag(SETTING, "comments", value);
}

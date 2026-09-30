import type { ScheduleMode } from "@gram-lang/kitchen";
import { ExitCode, reportError, GramCLIError } from "../errors";

/**
 * `--mise-en-place` accepts kebab-case on the command line (`per-section`)
 * but the renderer option is camelCase (`perSection`), so the mapping lives
 * here rather than being spelled out in each of `view`, `export` and `print`.
 */
const SCHEDULE_BY_FLAG: Record<string, ScheduleMode> = {
	"per-section": "perSection",
	upfront: "upfront",
};

export const MISE_EN_PLACE_FLAG_VALUES = Object.keys(SCHEDULE_BY_FLAG);

export const MISE_EN_PLACE_FLAG_DESCRIPTION = `When the mise en place is planned: ${MISE_EN_PLACE_FLAG_VALUES.join(" | ")} (default: per-section — right before each section; upfront — all at the start). Changes the total and idle times.`;

/**
 * Reports and exits on an unusable value rather than throwing, like
 * `parseNutritionBasis`: an argument-validation failure raised before any
 * work starts, from a command's `run()`.
 */
export function parseMiseEnPlace(value: unknown): ScheduleMode | undefined {
	if (value === undefined || value === null || value === "") return undefined;
	const mode = SCHEDULE_BY_FLAG[String(value)];
	if (!mode) {
		reportError(
			new GramCLIError(
				`Unknown --mise-en-place value "${value}". Expected one of: ${MISE_EN_PLACE_FLAG_VALUES.join(", ")}.`,
				ExitCode.Error,
			),
		);
		return process.exit(ExitCode.Error);
	}
	return mode;
}

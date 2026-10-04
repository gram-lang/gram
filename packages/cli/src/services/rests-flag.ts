import { REST_CHOICES, type RestChoice } from "@gram-lang/kitchen";
import { ExitCode, GramCLIError, reportError } from "../errors";

export const RESTS_FLAG_VALUES: readonly string[] = REST_CHOICES;

export const RESTS_FLAG_DESCRIPTION = `How long a rest written as a range (~_{12-24h}) lasts: ${RESTS_FLAG_VALUES.join(" | ")} (default: shortest). An exact rest and an active timer are not affected. Changes the total and idle times.`;

/**
 * Reports and exits on an unusable value, like `parseMiseEnPlace`: an
 * argument-validation failure raised before any work starts.
 */
export function parseRests(value: unknown): RestChoice | undefined {
	if (value === undefined || value === null || value === "") return undefined;
	if ((REST_CHOICES as readonly unknown[]).includes(value)) {
		return value as RestChoice;
	}
	reportError(
		new GramCLIError(
			`Unknown --rests value "${value}". Expected one of: ${RESTS_FLAG_VALUES.join(", ")}.`,
			ExitCode.Error,
		),
	);
	return process.exit(ExitCode.Error);
}

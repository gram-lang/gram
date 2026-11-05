import type { CommentsMode } from "@gram-lang/renderer";
import { ExitCode, GramCLIError, reportError } from "../errors";

export const COMMENTS_FLAG_VALUES: readonly string[] = ["show", "hide"];

export const COMMENTS_FLAG_DESCRIPTION = `Whether to show the comments of the recipe (// like this): ${COMMENTS_FLAG_VALUES.join(" | ")} (default: show). Applies to the recipe and to the work plan.`;

/**
 * Reports and exits on an unusable value, like `parseRests`: an
 * argument-validation failure raised before any work starts.
 */
export function parseComments(value: unknown): CommentsMode | undefined {
	if (value === undefined || value === null || value === "") return undefined;
	if (value === "show" || value === "hide") return value;
	reportError(
		new GramCLIError(
			`Unknown --comments value "${value}". Expected one of: ${COMMENTS_FLAG_VALUES.join(", ")}.`,
			ExitCode.Error,
		),
	);
	return process.exit(ExitCode.Error);
}

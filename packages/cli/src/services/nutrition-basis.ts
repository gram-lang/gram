import type { NutritionBasis } from "@gram-lang/renderer";
import { ExitCode, reportError, GramCLIError } from "../errors";

/**
 * `--nutrition` accepts kebab-case on the command line (`per-100g`) but the
 * renderer option is camelCase (`per100g`), so the mapping lives here rather
 * than being spelled out in each of `export`, `print` and `view`.
 */
const BASIS_BY_FLAG: Record<string, NutritionBasis> = {
	auto: "auto",
	total: "total",
	"per-portion": "perPortion",
	"per-100g": "per100g",
};

export const NUTRITION_BASIS_FLAG_VALUES = Object.keys(BASIS_BY_FLAG);

export const NUTRITION_BASIS_FLAG_DESCRIPTION = `Which nutrition basis to show: ${NUTRITION_BASIS_FLAG_VALUES.join(" | ")} (default: auto — per portion when the recipe declares one, otherwise the whole recipe)`;

/**
 * Reports and exits on an unusable value rather than throwing, matching how
 * `resolveScaleArg` handles a bad `--scale`: these are argument-validation
 * failures raised before any work starts, and every call site is a command's
 * `run()`, where an escaping throw surfaces as a stack trace instead of a
 * message.
 */
export function parseNutritionBasis(
	value: unknown,
): NutritionBasis | undefined {
	if (value === undefined || value === null || value === "") return undefined;
	const basis = BASIS_BY_FLAG[String(value)];
	if (!basis) {
		reportError(
			new GramCLIError(
				`Unknown --nutrition value "${value}". Expected one of: ${NUTRITION_BASIS_FLAG_VALUES.join(", ")}.`,
				ExitCode.Error,
			),
		);
		return process.exit(ExitCode.Error);
	}
	return basis;
}

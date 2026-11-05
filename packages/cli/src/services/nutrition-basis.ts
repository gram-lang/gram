import { type NutritionBasis, VIEW_SETTINGS } from "@gram-lang/renderer";
import { flagDefault, flagValues, parseChoiceFlag } from "./setting-flags";

const SETTING = VIEW_SETTINGS.nutritionBasis;

/** `auto`, `total`, `per-portion`, `per-100g`: kebab-case on the command line, camelCase everywhere else. */
export const NUTRITION_BASIS_FLAG_VALUES = flagValues(SETTING);

export const NUTRITION_BASIS_FLAG_DESCRIPTION = `Which nutrition basis to show: ${NUTRITION_BASIS_FLAG_VALUES.join(" | ")} (default: ${flagDefault(SETTING)} — per portion when the recipe declares one, otherwise the whole recipe)`;

/** Reports and exits on an unusable value, like every setting flag. */
export function parseNutritionBasis(
	value: unknown,
): NutritionBasis | undefined {
	return parseChoiceFlag(SETTING, "nutrition", value);
}

import type { GramLocale } from "@gram-lang/i18n";
import {
	type ChoiceSetting,
	VIEW_SETTINGS,
	type ViewSettings,
} from "@gram-lang/renderer";

/** The view settings the playground offers as a list of choices. */
export type ChoiceSettingKey = "miseEnPlace" | "rests" | "nutritionBasis";

/**
 * The words of each value of a choice setting, in the reader's language. The
 * values themselves come from the setting's descriptor: a value with no words
 * here fails to compile, so a new mode never shows up as a bare id.
 */
const LABELS: {
	[K in ChoiceSettingKey]: Record<ViewSettings[K], (t: GramLocale) => string>;
} = {
	miseEnPlace: {
		perSection: (t) => t.renderer.schedulePerSection,
		upfront: (t) => t.renderer.scheduleUpfront,
		perDay: (t) => t.renderer.schedulePerDay,
	},
	rests: {
		shortest: (t) => t.renderer.restsShortest,
		balanced: (t) => t.renderer.restsBalanced,
		longest: (t) => t.renderer.restsLongest,
	},
	nutritionBasis: {
		auto: (t) => t.playground.options.nutritionBasisAuto,
		total: (t) => t.renderer.nutritionWholeRecipe,
		perPortion: (t) => t.renderer.nutritionPerPortion,
		per100g: (t) => t.renderer.nutritionPer100g,
	},
};

/** The words of one value of a setting. */
export function settingValueLabel<K extends ChoiceSettingKey>(
	key: K,
	value: ViewSettings[K],
	t: GramLocale,
): string {
	return LABELS[key][value](t);
}

/** Every value of a setting, in the descriptor's order, with its words. */
export function settingChoices<K extends ChoiceSettingKey>(
	key: K,
	t: GramLocale,
): { value: ViewSettings[K]; label: string }[] {
	const setting = VIEW_SETTINGS[key] as ChoiceSetting<ViewSettings[K]>;
	return setting.values.map((value) => ({
		value,
		label: settingValueLabel(key, value, t),
	}));
}

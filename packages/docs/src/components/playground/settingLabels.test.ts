import { describe, expect, it } from "bun:test";
import { getDictionary } from "@gram-lang/i18n";
import { VIEW_SETTINGS } from "@gram-lang/renderer";
import {
	type ChoiceSettingKey,
	settingChoices,
	settingValueLabel,
} from "./settingLabels";

const KEYS: ChoiceSettingKey[] = ["miseEnPlace", "rests", "nutritionBasis"];

describe("the words of the setting values", () => {
	it("offers every value of the descriptor, in its order", () => {
		const t = getDictionary("en");
		for (const key of KEYS) {
			expect(settingChoices(key, t).map((c) => c.value)).toEqual([
				...VIEW_SETTINGS[key].values,
			]);
		}
	});

	it("words every value in every language, never as its id", () => {
		for (const lang of ["en", "fr"]) {
			const t = getDictionary(lang);
			for (const key of KEYS) {
				const labels = settingChoices(key, t).map((c) => c.label);
				for (const [i, label] of labels.entries()) {
					expect(label.length).toBeGreaterThan(0);
					expect(label).not.toBe(VIEW_SETTINGS[key].values[i]);
				}
				// Two values worded the same could not be told apart.
				expect(new Set(labels).size).toBe(labels.length);
			}
		}
	});

	it("words one value in the language asked", () => {
		expect(settingValueLabel("rests", "longest", getDictionary("en"))).toBe(
			"Longest",
		);
		expect(
			settingValueLabel("miseEnPlace", "upfront", getDictionary("fr")),
		).not.toBe(
			settingValueLabel("miseEnPlace", "upfront", getDictionary("en")),
		);
	});
});

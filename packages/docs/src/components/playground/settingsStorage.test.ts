import { describe, expect, it } from "bun:test";
import { SETTINGS } from "@gram-lang/renderer";
import {
	SETTING_STORAGE_KEYS,
	type SettingStorage,
	defaultOptions,
	isOptionModified,
	loadOptions,
	loadSetting,
	saveOptions,
	saveSetting,
} from "./settingsStorage";

function memory(initial: Record<string, string> = {}): SettingStorage & {
	data: Record<string, string>;
} {
	const data = { ...initial };
	return {
		data,
		getItem: (k) => data[k] ?? null,
		setItem: (k, v) => {
			data[k] = v;
		},
	};
}

describe("playground setting storage", () => {
	it("keeps the keys a choice was saved under before", () => {
		expect(SETTING_STORAGE_KEYS.miseEnPlace).toBe("gram-playground-schedule");
		expect(SETTING_STORAGE_KEYS.rests).toBe("gram-playground-rests");
	});

	it("reads back a saved choice", () => {
		const storage = memory({
			"gram-playground-schedule": "upfront",
			"gram-playground-rests": "longest",
		});
		expect(loadSetting("miseEnPlace", storage)).toBe("upfront");
		expect(loadSetting("rests", storage)).toBe("longest");
	});

	it("falls back on the default for nothing saved, an unknown value or no storage", () => {
		expect(loadSetting("miseEnPlace", memory())).toBe("perSection");
		expect(
			loadSetting("rests", memory({ "gram-playground-rests": "forever" })),
		).toBe("shortest");
		expect(loadSetting("rests", undefined)).toBe("shortest");
	});

	it("survives a storage that throws", () => {
		const broken: SettingStorage = {
			getItem: () => {
				throw new Error("blocked");
			},
			setItem: () => {
				throw new Error("blocked");
			},
		};
		expect(loadSetting("miseEnPlace", broken)).toBe("perSection");
		expect(() => saveSetting("miseEnPlace", "upfront", broken)).not.toThrow();
	});

	it("saves under the setting's key and reads it back", () => {
		const storage = memory();
		saveSetting("rests", "balanced", storage);
		expect(storage.data["gram-playground-rests"]).toBe("balanced");
		expect(loadSetting("rests", storage)).toBe("balanced");
	});

	it("gives every setting its own storage key", () => {
		const keys = Object.values(SETTING_STORAGE_KEYS);
		expect(new Set(keys).size).toBe(keys.length);
		expect(Object.keys(SETTING_STORAGE_KEYS).sort()).toEqual(
			SETTINGS.map((d) => d.key).sort(),
		);
	});

	it("stores a flag as true or false and reads it back", () => {
		const storage = memory();
		saveSetting("massStandardization", false, storage);
		expect(storage.data["gram-playground-mass-standardization"]).toBe("false");
		expect(loadSetting("massStandardization", storage)).toBe(false);
		expect(
			loadSetting(
				"massStandardization",
				memory({ "gram-playground-mass-standardization": "maybe" }),
			),
		).toBe(true);
	});
});

describe("studio options", () => {
	it("start on the defaults of the descriptors: the analyzer all on", () => {
		expect(defaultOptions()).toEqual({
			bakersMath: true,
			massStandardization: true,
			yieldCalculation: true,
			nutritionEstimation: true,
			comments: "show",
			nutritionBasis: "auto",
			bakersMathOnly: false,
			stepQuantities: "show",
			bakersReference: undefined,
		});
	});

	it("are saved and read back, all but the baker's reference", () => {
		const storage = memory();
		saveOptions(
			{
				...defaultOptions(),
				yieldCalculation: false,
				stepQuantities: "hide",
				nutritionBasis: "per100g",
				bakersReference: "flour",
			},
			storage,
		);
		expect(loadOptions(storage)).toEqual({
			...defaultOptions(),
			yieldCalculation: false,
			stepQuantities: "hide",
			nutritionBasis: "per100g",
		});
	});

	it("tell which option differs from its default", () => {
		const options = { ...defaultOptions(), comments: "hide" as const };
		expect(isOptionModified(options, "comments")).toBe(true);
		expect(isOptionModified(options, "yieldCalculation")).toBe(false);
	});
});

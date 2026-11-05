import { describe, expect, it } from "bun:test";
import {
	SETTING_STORAGE_KEYS,
	type SettingStorage,
	loadSetting,
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

	it("leaves a setting without a storage key on its default, unsaved", () => {
		const storage = memory();
		saveSetting("comments", "hide", storage);
		expect(storage.data).toEqual({});
		expect(loadSetting("comments", storage)).toBe("show");
	});
});

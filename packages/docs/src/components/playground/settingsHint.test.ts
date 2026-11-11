import { describe, expect, it } from "bun:test";
import {
	SETTINGS_HINT_STORAGE_KEY,
	markSettingsHintSeen,
	shouldShowSettingsHint,
} from "./settingsHint";
import type { SettingStorage } from "./settingsStorage";

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

const throwing: SettingStorage = {
	getItem: () => {
		throw new Error("blocked");
	},
	setItem: () => {
		throw new Error("blocked");
	},
};

describe("playground settings hint", () => {
	it("shows on a first visit", () => {
		expect(shouldShowSettingsHint(memory())).toBe(true);
	});

	it("never shows again once seen", () => {
		const storage = memory();
		markSettingsHintSeen(storage);
		expect(storage.data[SETTINGS_HINT_STORAGE_KEY]).toBe("true");
		expect(shouldShowSettingsHint(storage)).toBe(false);
	});

	it("stays hidden when storage is missing or blocked", () => {
		expect(shouldShowSettingsHint(undefined)).toBe(false);
		expect(shouldShowSettingsHint(throwing)).toBe(false);
		expect(() => markSettingsHintSeen(throwing)).not.toThrow();
	});
});

import {
	type AnySetting,
	type RecipeSettings,
	SETTINGS,
	type ViewSettings,
} from "@gram-lang/renderer";

type Settings = ViewSettings & RecipeSettings;
export type StoredSettingKey = keyof Settings;

/**
 * The browser storage key of each setting the playground remembers. The
 * existing keys are kept as they are, so a choice saved before this module
 * still applies.
 */
export const SETTING_STORAGE_KEYS: Partial<Record<StoredSettingKey, string>> = {
	miseEnPlace: "gram-playground-schedule",
	rests: "gram-playground-rests",
};

/** The part of `Storage` this module uses, so a test can hand it a plain object. */
export type SettingStorage = Pick<Storage, "getItem" | "setItem">;

function descriptorOf(key: StoredSettingKey): AnySetting {
	const descriptor = SETTINGS.find((d) => d.key === key);
	if (!descriptor) throw new Error(`Unknown setting: ${key}`);
	return descriptor;
}

/** A flag is stored as `"true"` or `"false"`, a choice as its value. */
function fromStored(descriptor: AnySetting, raw: string | null): unknown {
	if (descriptor.type !== "flag") return raw;
	return raw === "true" ? true : raw === "false" ? false : undefined;
}

function browserStorage(): SettingStorage | undefined {
	try {
		return globalThis.localStorage;
	} catch {
		// Storage can be blocked or absent (private window, embedded frame).
		return undefined;
	}
}

/**
 * The saved value of a setting, or its default when nothing usable is saved
 * (nothing yet, a value from an older version, blocked storage).
 */
export function loadSetting<K extends StoredSettingKey>(
	key: K,
	storage: SettingStorage | undefined = browserStorage(),
): Settings[K] {
	const descriptor = descriptorOf(key);
	const storageKey = SETTING_STORAGE_KEYS[key];
	let raw: string | null = null;
	if (storageKey && storage) {
		try {
			raw = storage.getItem(storageKey);
		} catch {
			// Same as nothing saved.
		}
	}
	return descriptor.parse(fromStored(descriptor, raw)) as Settings[K];
}

/** Remembers a setting; without storage, the choice just won't survive a reload. */
export function saveSetting<K extends StoredSettingKey>(
	key: K,
	value: Settings[K],
	storage: SettingStorage | undefined = browserStorage(),
): void {
	const storageKey = SETTING_STORAGE_KEYS[key];
	if (!storageKey || !storage) return;
	try {
		storage.setItem(storageKey, String(value));
	} catch {
		// Nothing to do.
	}
}

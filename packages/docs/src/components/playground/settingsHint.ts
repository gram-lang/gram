import type { SettingStorage } from "./settingsStorage";

/**
 * The one-time hint that points a first-time visitor at the Settings button:
 * shown until they open the settings or dismiss it, then never again.
 */
export const SETTINGS_HINT_STORAGE_KEY = "gram-playground-settings-hint-seen";

function browserStorage(): SettingStorage | undefined {
	try {
		return globalThis.localStorage;
	} catch {
		// Storage can be blocked or absent (private window, embedded frame).
		return undefined;
	}
}

/**
 * Whether the hint should show. Without usable storage it stays hidden: a
 * hint that comes back on every visit would be worse than none.
 */
export function shouldShowSettingsHint(
	storage: SettingStorage | undefined = browserStorage(),
): boolean {
	if (!storage) return false;
	try {
		return storage.getItem(SETTINGS_HINT_STORAGE_KEY) !== "true";
	} catch {
		return false;
	}
}

/** Remembers that the visitor has seen the hint (or found the settings). */
export function markSettingsHintSeen(
	storage: SettingStorage | undefined = browserStorage(),
): void {
	try {
		storage?.setItem(SETTINGS_HINT_STORAGE_KEY, "true");
	} catch {
		// Nothing to do: the hint simply may show again next time.
	}
}

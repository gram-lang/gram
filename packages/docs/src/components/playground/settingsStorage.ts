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
export const SETTING_STORAGE_KEYS: Record<StoredSettingKey, string> = {
	miseEnPlace: "gram-playground-schedule",
	rests: "gram-playground-rests",
	comments: "gram-playground-comments",
	nutritionBasis: "gram-playground-nutrition-basis",
	bakersMathOnly: "gram-playground-bakers-math-only",
	stepQuantities: "gram-playground-step-quantities",
	bakersMath: "gram-playground-bakers-math",
	massStandardization: "gram-playground-mass-standardization",
	yieldCalculation: "gram-playground-yield-calculation",
	nutritionEstimation: "gram-playground-nutrition-estimation",
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

/**
 * The options of the studio: every setting but the two of the timeline
 * (`miseEnPlace`, `rests`, kept on their own), and the baker's reference, an
 * input of the session that is not remembered.
 */
export type PlaygroundOptions = RecipeSettings &
	Omit<ViewSettings, "miseEnPlace" | "rests"> & {
		bakersReference: string | undefined;
	};

/** The settings `PlaygroundOptions` carries, in the order of the descriptors. */
export const OPTION_SETTING_KEYS = SETTINGS.map(
	(d) => d.key as StoredSettingKey,
).filter(
	(key): key is Exclude<StoredSettingKey, "miseEnPlace" | "rests"> =>
		key !== "miseEnPlace" && key !== "rests",
);

/** Every option on its default: the defaults of the setting descriptors. */
export function defaultOptions(): PlaygroundOptions {
	const out = { bakersReference: undefined } as PlaygroundOptions;
	for (const key of OPTION_SETTING_KEYS) {
		(out as unknown as Record<string, unknown>)[key] =
			descriptorOf(key).default;
	}
	return out;
}

/** The options as saved, each one missing or unusable on its default. */
export function loadOptions(
	storage: SettingStorage | undefined = browserStorage(),
): PlaygroundOptions {
	const out = defaultOptions();
	for (const key of OPTION_SETTING_KEYS) {
		(out as unknown as Record<string, unknown>)[key] = loadSetting(
			key,
			storage,
		);
	}
	return out;
}

/** Remembers every option but the baker's reference. */
export function saveOptions(
	options: PlaygroundOptions,
	storage: SettingStorage | undefined = browserStorage(),
): void {
	for (const key of OPTION_SETTING_KEYS) {
		saveSetting(key, options[key] as Settings[typeof key], storage);
	}
}

/** Whether `key` differs from its default in `options`. */
export function isOptionModified(
	options: PlaygroundOptions,
	key: (typeof OPTION_SETTING_KEYS)[number],
): boolean {
	return options[key] !== descriptorOf(key).default;
}

import { compileDictionary, type LanguageDict } from "./dictionary";

const en: LanguageDict = {
	d: ["day", "days"],
	h: ["hour", "hours"],
	m: ["min", "mins", "minute", "minutes"],
	s: ["sec", "secs", "second", "seconds"],
};

const fr: LanguageDict = {
	d: ["j", "jour", "jours"],
	h: ["heure", "heures"],
	m: ["min", "mins", "minute", "minutes"],
	s: ["sec", "secs", "seconde", "secondes"],
};

export const TIME_DICTIONARIES = { en, fr };
export const { byLang: TIME_BY_LANG, global: TIME_GLOBAL } =
	compileDictionary(TIME_DICTIONARIES);

/**
 * Helper to normalize a time unit string into its canonical alias ('h', 'm', 's').
 */
export const resolveTimeUnit = (
	unit?: string | null,
	lang?: string,
): string => {
	if (!unit) return "";
	const clean = unit.trim().toLowerCase();

	if (lang && TIME_BY_LANG[lang]?.[clean]) {
		return TIME_BY_LANG[lang][clean];
	}

	return TIME_GLOBAL[clean] || clean;
};

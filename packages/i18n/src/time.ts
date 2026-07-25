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

// Audit 2026-07-22, i18n finding F-02/F-05, Phase 17: previously inlined as
// bare multipliers (`* 60 * 24`, `* 60`, `/ 60`) inside
// `@gram-lang/kitchen`'s `quantityToMinutes` — the numeric relationship
// between time units belongs alongside the canonical unit names above, not
// hardcoded in a downstream consumer.
export const TIME_TO_MINUTES: Record<string, number> = {
	d: 60 * 24,
	h: 60,
	m: 1,
	s: 1 / 60,
};

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

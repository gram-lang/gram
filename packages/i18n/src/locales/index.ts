import { en, type GramLocale } from "./en";
import { fr } from "./fr";

const dictionaries: Record<string, GramLocale> = {
	en,
	fr,
};

export function getDictionary(lang?: string): GramLocale {
	// Extract language code (e.g. 'fr-FR' -> 'fr')
	const parts = (lang || "en").split("-");
	const code = (parts[0] || "en").toLowerCase();
	return dictionaries[code] || en;
}

export type { GramLocale };

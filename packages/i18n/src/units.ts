import { compileDictionary, type LanguageDict } from "./dictionary";

const en: LanguageDict = {
	// Volume — spoons
	tsp: ["teaspoon", "teaspoons"],
	tbsp: ["tablespoon", "tablespoons"],
	// Volume — small measures (sub-tsp)
	tad: ["tads"],
	dash: ["dashes"],
	pinch: ["pinches"],
	smidgen: ["smidgen", "smidge", "smidgens"],
	drop: ["drops"],
	// Volume — cups & imperial
	cup: ["cups"],
	pt: ["pint", "pints"],
	// "quart"/"quarts" is deliberately NOT an alias for "qt" here (audit
	// 2026-07-22, finding F-01): the French word "quart" means "a quarter"
	// (as in "un quart d'heure"), not the US liquid measure — the identical
	// spelling made it a silent false-friend when both dictionaries mapped it
	// to the same canonical. "qt" is still usable by typing it directly.
	qt: [],
	gal: ["gallon", "gallons"],
	"fl oz": ["floz", "fl. oz.", "fluid ounce", "fluid ounces"],
	// Volume — metric
	ml: ["milliliter", "milliliters"],
	cl: ["centiliter", "centiliters"],
	dl: ["deciliter", "deciliters"],
	l: ["liter", "liters"],
	// Weight — metric
	mg: ["milligram", "milligrams"],
	g: ["gram", "grams"],
	kg: ["kilo", "kilos", "kilogram", "kilograms"],
	// Weight — imperial
	oz: ["ounce", "ounces"],
	lb: ["lbs", "pound", "pounds"],
};

const fr: LanguageDict = {
	// Volume — cuillères
	tsp: [
		"càc",
		"cac",
		"c.à.c",
		"cuillère à café",
		"cuillères à café",
		"cuillere a cafe",
		"cuilleres a cafe",
	],
	tbsp: [
		"càs",
		"cas",
		"c.à.s",
		"cuillère à soupe",
		"cuillères à soupe",
		"cuillere a soupe",
		"cuilleres a soupe",
	],
	// Volume — petites mesures (sous-càc)
	tad: ["soupçon", "soupcons"],
	dash: ["trait"],
	pinch: ["pincée", "pincee", "pincées", "pincees"],
	smidgen: ["poussière", "poussiere", "poussières", "poussieres"],
	drop: ["goutte", "gouttes"],
	// Pas d'alias FR pour "quart" (cf. dict EN ci-dessus) ni pour "pinte" : la
	// pinte française historique n'a pas de valeur moderne fiable et unique
	// (elle a varié de ~0,93 L à plus de 3 L selon les régions avant la
	// métrication) — mieux vaut un avertissement « unité inconnue » qu'une
	// conversion silencieusement fausse.
	"fl oz": ["once liquide", "onces liquides"],
	// Volume — métrique
	ml: ["millilitre", "millilitres"],
	cl: ["centilitre", "centilitres"],
	dl: ["décilitre", "décilitres", "decilitre", "decilitres"],
	l: ["litre", "litres"],
	// Volume — tasse française (250 mL), distincte du "cup" nord-américain
	// (236,588 mL) : les fusionner sous un seul canonique produisait une
	// erreur silencieuse d'environ 6 % (audit 2026-07-22, finding F-01).
	tasse: ["tasse", "tasses"],
	// Poids — métrique
	mg: ["milligramme", "milligrammes"],
	g: ["gramme", "grammes"],
	kg: ["kilo", "kilos", "kilogramme", "kilogrammes"],
	// Poids — livre française (500 g, la "livre métrique" toujours en usage
	// courant), distincte de la livre impériale "lb" (453,592 g) — les fusionner
	// produisait ~500 g → 453 g, une erreur silencieuse d'environ 10 %.
	livre: ["livre", "livres"],
	// Poids — impérial
	oz: ["once", "onces"],
};

export const UNIT_DICTIONARIES = { en, fr };
export const { byLang: UNIT_BY_LANG, global: UNIT_GLOBAL } =
	compileDictionary(UNIT_DICTIONARIES);

/**
 * Normalizes a raw string unit into a standard canon unit.
 * Examples: 'càs' -> 'tbsp', 'kilo' -> 'kg'.
 */
export function normalizeUnit(
	rawUnit: string | undefined | null,
	lang?: string,
): string {
	if (!rawUnit) return "";
	const clean = rawUnit.toLowerCase().trim();

	if (lang && UNIT_BY_LANG[lang]?.[clean]) {
		return UNIT_BY_LANG[lang][clean];
	}

	return UNIT_GLOBAL[clean] || clean;
}

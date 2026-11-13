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
 * Spelling-insensitive lookup key for a unit: lowercased, diacritics stripped,
 * and abbreviation punctuation / spaces removed, so "c.à.s", "c. à s.", "c.a.s"
 * and "càs" all collapse to "cas". Only used to *find* a canonical unit --
 * unknown units are still returned as the author wrote them.
 */
export function unitKey(raw: string): string {
	return raw
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/[.'’\s]/g, "");
}

const foldTable = (table: Record<string, string>): Record<string, string> =>
	Object.fromEntries(Object.entries(table).map(([k, v]) => [unitKey(k), v]));

const UNIT_BY_LANG_FOLDED = Object.fromEntries(
	Object.entries(UNIT_BY_LANG).map(([lang, table]) => [lang, foldTable(table)]),
);
const UNIT_GLOBAL_FOLDED = foldTable(UNIT_GLOBAL);

export interface UnitMap {
	base: string;
	map: Record<string, number>;
}

// Previously declared in `@gram-lang/analyzer` (`mass_standardization.ts`)
// — a second package owning
// canonical -> physical-factor knowledge for the same units i18n already
// owns alias -> canonical resolution for. `unit-inventory-invariant.test.ts`
// (this package's tests/) checks the two stay in sync now that they're
// co-located; before this move it caught real drift across a package
// boundary (analyzer had `gal` with no matching i18n alias at all).
export const UNIT_CONVERSIONS: { mass: UnitMap; volume: UnitMap } = {
	mass: {
		base: "g",
		map: {
			mg: 0.001,
			g: 1,
			kg: 1000,
			oz: 28.3495,
			lb: 453.592,
			// French "livre" (métrique) — see above for why this is a distinct
			// canonical from "lb" rather than an alias of it.
			livre: 500,
		},
	},
	volume: {
		base: "ml",
		map: {
			ml: 1,
			cl: 10,
			dl: 100,
			l: 1000,
			drop: 0.078,
			smidgen: 0.156,
			pinch: 0.3125,
			dash: 0.625,
			tad: 1.25,
			tsp: 4.9289,
			tbsp: 14.7868,
			cup: 236.588,
			// French "tasse" — see above for why this is a distinct canonical
			// from "cup" rather than an alias of it.
			tasse: 250,
			pt: 473.176,
			qt: 946.353,
			gal: 3785.41,
			"fl oz": 29.5735,
		},
	},
};

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
	if (UNIT_GLOBAL[clean]) return UNIT_GLOBAL[clean];

	const key = unitKey(clean);
	return (
		(lang && UNIT_BY_LANG_FOLDED[lang]?.[key]) ||
		UNIT_GLOBAL_FOLDED[key] ||
		clean
	);
}

/**
 * True for a mass/volume unit at or above its category's base unit (g, kg,
 * oz, lb, ml, cl, dl, l, tsp, tbsp, cup, ...) — the kind of unit a cook
 * measures with a scale or a spoon, not a lab balance. Callers use this to
 * decide when a quantity should be rounded coarser for display than the
 * precision it's stored at. Sub-base units (mg, drop, smidgen, pinch, dash)
 * return false since their values are already small.
 */
export function isCoarseUnit(rawUnit: string | undefined | null): boolean {
	const normalized = normalizeUnit(rawUnit);
	if (!normalized) return false;
	for (const category of [UNIT_CONVERSIONS.mass, UNIT_CONVERSIONS.volume]) {
		const factor = category.map[normalized];
		if (factor !== undefined) return factor >= 1;
	}
	return false;
}

/** The metric units a mass or a volume is read in, smallest first. */
const METRIC_LADDER = {
	mass: { units: ["mg", "g", "kg"], large: "kg" },
	volume: { units: ["ml", "cl", "dl", "l"], large: "l" },
} as const;

/**
 * True for a metric unit of mass (mg, g, kg): a quantity in it is already a
 * weight, so a standardized mass next to it would only say it again. An
 * imperial mass (oz, lb) is not one: its weight in grams still tells something.
 */
export function isMetricMassUnit(
	rawUnit: string | undefined | null,
	lang?: string,
): boolean {
	return (METRIC_LADDER.mass.units as readonly string[]).includes(
		normalizeUnit(rawUnit, lang),
	);
}

/**
 * A metric mass or volume in kilograms or liters once it reaches 1000 g or
 * 1000 ml (3900 g → 3.9 kg, 2250 ml → 2.25 l), rounded to 2 decimals; any
 * other amount comes back as it was. For what a reader buys (a shopping list)
 * or reads as a total (the weight of a recipe): what is weighed stays in grams,
 * since a scale shows grams and a cook writes "1500 g of flour".
 * Every surface reads a large amount through this, so a shopping list says
 * the same thing in the renderer, `gram shop` and `gram cook`.
 */
export function toLargerMetricUnit(
	value: number,
	rawUnit: string | undefined | null,
	lang?: string,
): { value: number; unit: string } {
	const unit = rawUnit ?? "";
	const canonical = normalizeUnit(unit, lang);
	for (const [category, ladder] of Object.entries(METRIC_LADDER) as [
		keyof typeof METRIC_LADDER,
		(typeof METRIC_LADDER)[keyof typeof METRIC_LADDER],
	][]) {
		if (canonical === ladder.large) break;
		if (!(ladder.units as readonly string[]).includes(canonical)) continue;
		const factor = UNIT_CONVERSIONS[category].map[canonical] ?? 1;
		const base = value * factor;
		if (base < 1000) break;
		return { value: Math.round(base / 10) / 100, unit: ladder.large };
	}
	return { value, unit };
}

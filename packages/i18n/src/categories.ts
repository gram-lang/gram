export const CATEGORY_KEYS = [
	"vegetables",
	"fruits",
	"meat",
	"seafood",
	"dairy",
	"grains",
	"legumes",
	"nuts",
	"oils",
	"herbs",
	"spices",
	"condiments",
	"sugars",
	"beverages",
	"other",
] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];

// Audit 2026-07-22, i18n finding F-03, Phase 18: previously a
// `Record<lang, string[]>` of translated *labels* only, with no stable,
// language-independent identity — the label itself got persisted as data in
// `ingredients.yaml` (`db-enricher.ts`'s AI prompt built directly from
// `getDefaultCategories(lang).join(", ")`, and the AI's response was written
// back verbatim). A database enriched with `language: "fr"` ended up with
// `category: "Légumes"`, which a `gram shop` run in English can't group —
// string equality, no shared key. `CATEGORY_KEYS` is the stable identity to
// persist as data; the labels below are display-only, indexed by that same
// key so the two locales can never silently drift out of parity the way two
// positional arrays could (TypeScript requires every key present in both).
const CATEGORY_LABELS: Record<string, Record<CategoryKey, string>> = {
	fr: {
		vegetables: "Légumes",
		fruits: "Fruits",
		meat: "Viandes",
		seafood: "Poissons & Fruits de mer",
		dairy: "Crémerie",
		grains: "Céréales",
		legumes: "Légumineuses",
		nuts: "Noix & Graines",
		oils: "Huiles",
		herbs: "Herbes",
		spices: "Épices",
		condiments: "Condiments",
		sugars: "Sucres",
		beverages: "Boissons",
		other: "Autres",
	},
	en: {
		vegetables: "Vegetables",
		fruits: "Fruits",
		meat: "Meat",
		seafood: "Seafood",
		dairy: "Dairy",
		grains: "Grains",
		legumes: "Legumes",
		nuts: "Nuts",
		oils: "Oils",
		herbs: "Herbs",
		spices: "Spices",
		condiments: "Condiments",
		sugars: "Sugars",
		beverages: "Beverages",
		other: "Other",
	},
};

/**
 * Display label for every category key, in canonical order — for showing to
 * a human (a prompt, a UI list). Never persist these as data; persist the
 * key (`CategoryKey`) instead, and translate to a label only at display time.
 */
export function getCategoryLabels(lang = "en"): Record<CategoryKey, string> {
	return CATEGORY_LABELS[lang] ?? CATEGORY_LABELS.en!;
}

export function isCategoryKey(value: string): value is CategoryKey {
	return (CATEGORY_KEYS as readonly string[]).includes(value);
}

/**
 * Returns display labels only, in canonical key order. Kept for the one
 * legitimate label-only use left (`shopper.ts`'s sort-order comparison,
 * which also has to keep matching pre-F-03 databases that already have a
 * translated label — not a key — written into `category`). Prefer
 * `getCategoryLabels`/`CATEGORY_KEYS` for anything that persists a category
 * as data.
 */
export function getDefaultCategories(lang = "en"): string[] {
	const labels = getCategoryLabels(lang);
	return CATEGORY_KEYS.map((key) => labels[key]);
}

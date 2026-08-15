/**
 * The single source of truth for which nutrients Gram knows about, in display
 * order.
 *
 * This table used to be written out by hand in six places (this schema, the
 * recipe-level aggregation, `gram db enrich`, `gram db lint`, `gram db search`
 * and the language server's hover), and they had drifted into three different
 * sets: `db enrich` could never propose `mono_fat`/`poly_fat` even though
 * `db lint` validated them, and the recipe totals silently dropped every fat
 * subtype and alcohol. Everything that enumerates nutrients now derives from
 * here instead.
 *
 * - `unit` is the unit values are stored in *in the database*. Keeping it here
 *   is what settles the sodium ambiguity that made the LSP hover multiply by
 *   1000 while the analyzer treated the same field as milligrams.
 * - `dp` is the decimal precision used when rounding an aggregated total.
 * - `parent` marks a sub-macro whose value is included in another's. It drives
 *   both the database coherence checks (`sat+mono+poly <= fat`) and the
 *   "— of which …" indentation when a nutrient is displayed.
 * - `label` is the canonical English name. Localized surfaces translate it via
 *   @gram-lang/i18n keyed by `key`; the language server and `gram db search`
 *   use it directly.
 *
 * The order is the one nutrition declarations conventionally use (energy, fat
 * and its subtypes, carbohydrate and its subtypes, fibre, protein, salt), so
 * every sub-macro follows its parent and a consumer can render the list top to
 * bottom without reordering. It is also the key order of the emitted JSON.
 */
export const NUTRIENTS = [
	{
		key: "calories",
		label: "Calories",
		unit: "kcal",
		dp: 0,
		required: true,
		parent: null,
	},
	{ key: "fat", label: "Fat", unit: "g", dp: 1, required: true, parent: null },
	{
		key: "sat_fat",
		label: "Saturates",
		unit: "g",
		dp: 1,
		required: false,
		parent: "fat",
	},
	{
		key: "mono_fat",
		label: "Mono-unsaturates",
		unit: "g",
		dp: 1,
		required: false,
		parent: "fat",
	},
	{
		key: "poly_fat",
		label: "Poly-unsaturates",
		unit: "g",
		dp: 1,
		required: false,
		parent: "fat",
	},
	{
		key: "carbs",
		label: "Carbohydrates",
		unit: "g",
		dp: 1,
		required: true,
		parent: null,
	},
	{
		key: "sugar",
		label: "Sugars",
		unit: "g",
		dp: 1,
		required: false,
		parent: "carbs",
	},
	{
		key: "fiber",
		label: "Fiber",
		unit: "g",
		dp: 1,
		required: false,
		parent: null,
	},
	{
		key: "protein",
		label: "Protein",
		unit: "g",
		dp: 1,
		required: true,
		parent: null,
	},
	{
		key: "sodium",
		label: "Sodium",
		unit: "mg",
		dp: 0,
		required: false,
		parent: null,
	},
	{
		key: "alcohol",
		label: "Alcohol",
		unit: "g",
		dp: 1,
		required: false,
		parent: null,
	},
] as const;

export type NutrientDef = (typeof NUTRIENTS)[number];
export type NutrientKey = NutrientDef["key"];
export type NutrientUnit = NutrientDef["unit"];

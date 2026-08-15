import { z } from "zod";

export const AnalyzerOptionsSchema = z.object({
	enableMassStandardization: z.boolean().optional(),
	enableYieldCalculation: z.boolean().optional(),
	enableNutritionalEstimation: z.boolean().optional(),
	enableBakersMath: z.boolean().optional(),
	bakersReference: z.string().optional(),
	// Overrides the recipe's own `portions:` frontmatter when a caller needs a
	// different divisor (e.g. a UI showing "per 2 servings" of a 4-portion
	// recipe). Absent means "trust the frontmatter" — see resolvePortions().
	portions: z.number().positive().optional(),
	// The recipe's language, used to disambiguate a unit alias that collides
	// between languages (e.g. a future addition colliding the way "quart"
	// once did — see @gram-lang/i18n's units.ts) instead of relying on
	// whichever language happens to be merged last into the global fallback
	// table. Threaded through to every `normalizeUnit` call this package
	// makes (`convertUnit`, `standardizeMass`).
	lang: z.string().optional(),
});

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

type RequiredNutrientKey = Extract<NutrientDef, { required: true }>["key"];
type OptionalNutrientKey = Exclude<NutrientKey, RequiredNutrientKey>;

/**
 * Built by reduction over NUTRIENTS rather than spelled out, so adding a
 * nutrient to the table is the only edit needed. The cast restores the precise
 * per-key shape that `Object.fromEntries` widens away — `z.infer` on the
 * result is what `Macros` is, so losing it would degrade every downstream type
 * to `Record<string, number>`.
 */
const nutritionShape = Object.fromEntries(
	NUTRIENTS.map((n) => [
		n.key,
		n.required ? z.number().min(0) : z.number().min(0).optional(),
	]),
) as Record<RequiredNutrientKey, z.ZodNumber> &
	Record<OptionalNutrientKey, z.ZodOptional<z.ZodNumber>>;

export const NutritionSchema = z.object(nutritionShape);

/**
 * One nutrient profile: per 100 g for a database entry, per whole recipe /
 * portion / 100 g for an analyzed one. Both sides share this shape by
 * construction — the aggregation multiplies the former into the latter.
 */
export type Macros = z.infer<typeof NutritionSchema>;

export const IngredientDataSchema = z.object({
	name: z.string(),
	physical: z
		.object({
			// `density` was required whenever `physical` was present at all,
			// which rejected any entry described only by `unit_weight` (count
			// -> mass, e.g. "1 avocado") — including the analyzer's own README
			// example and test fixtures. An ingredient can legitimately have
			// either, both, or neither.
			density: z.number().positive().optional(),
			yield: z.number().gt(0).max(1).optional(),
			unit_weight: z.number().positive().optional(),
		})
		.optional(),
	nutrition: NutritionSchema.optional(),
	aliases: z.array(z.string()).optional(),
	tags: z.array(z.string()).optional(),
	category: z.string().optional(),
});

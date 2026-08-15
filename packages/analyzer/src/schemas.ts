import { z } from "zod";
// The table lives in its own zod-free module: importing it must not drag a
// schema library into a browser bundle. The renderer and the VS Code webview
// reach it through the package's `./nutrients` subpath for exactly that
// reason — see packages/analyzer/package.json.
import { NUTRIENTS, type NutrientDef, type NutrientKey } from "./nutrients";

export * from "./nutrients";

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

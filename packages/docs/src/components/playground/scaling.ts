import {
	convertUnit,
	type IngredientData,
	parseDensityOverrides,
	resolveCanonicalId,
	resolveIngredientDensity,
} from "@gram-lang/analyzer";
import {
	applyScale,
	type CompilationResult,
	resolveScaleFactor,
} from "@gram-lang/kitchen";

/** What the cook asked for: a percentage of the recipe, or an ingredient at a quantity. */
export interface ScaleRequest {
	/** The ingredient to scale by, as the options list offers it. */
	targetId: string | null;
	targetQty: number | null;
	targetUnit: string;
	/** The percentage of the whole recipe, "150". Read when there is no target. */
	factorString: string;
}

export interface ScaleOutcome {
	/** The recipe, scaled, or as it was when the scale could not be applied. */
	result: CompilationResult;
	/** The percentage a target resolved to, "110", to show in the whole-recipe field. */
	factorString?: string;
	/** Why the scale could not be applied. */
	error?: string;
}

/**
 * The id of the compiled recipe's shopping list that an ingredient of the
 * options list stands for. The list offered to the cook is the analyzed one,
 * where `farine` is `flour`; the scale reads the compiled one, where the
 * recipe's own word is the id. The ingredient is found again by the database
 * key both come from. When several lines of the recipe are the same ingredient
 * there is no one line to scale by: the id is left as it is, and the scale
 * says so.
 */
export function compiledTargetId(
	chosen: string,
	shoppingList: readonly { id: string }[],
	database: Record<string, IngredientData>,
): string {
	if (shoppingList.some((item) => item.id === chosen)) return chosen;
	const matches = new Set(
		shoppingList
			.filter((item) => resolveCanonicalId(item.id, database) === chosen)
			.map((item) => item.id),
	);
	const [only] = matches;
	return matches.size === 1 && only !== undefined ? only : chosen;
}

/**
 * Scales the compiled recipe: by an ingredient at a quantity when there is a
 * target, else by a percentage of the whole. Never throws: a scale that cannot
 * be applied comes back as `error`, with the recipe unscaled.
 */
export function scaleRecipe(
	result: CompilationResult,
	request: ScaleRequest,
	database: Record<string, IngredientData>,
	lang: string,
): ScaleOutcome {
	try {
		if (request.targetId && request.targetQty !== null) {
			// Same-family units (g<->kg, ml<->l...) always convert; crossing
			// mass<->volume (e.g. targeting "water=150g" in a recipe written in
			// ml) also works whenever a density is available, from the recipe's
			// own `densities:` frontmatter or the loaded ingredient database.
			const id = compiledTargetId(
				request.targetId,
				result.shopping_list ?? [],
				database,
			);
			const overrides = parseDensityOverrides(result.meta);
			const density = resolveIngredientDensity(
				id,
				database,
				overrides,
			)?.density;
			const resolution = resolveScaleFactor(
				result,
				{
					type: "target",
					id,
					qty: request.targetQty,
					unit: request.targetUnit || null,
				},
				(value, from, to) => convertUnit(value, from, to, density, lang),
			);
			return {
				result: applyScale(result, resolution.factor),
				factorString: (resolution.factor * 100).toFixed(2).replace(/\.00$/, ""),
			};
		}
		const factor = Number.parseFloat(request.factorString) / 100;
		if (!Number.isNaN(factor) && factor > 0 && factor !== 1) {
			const resolution = resolveScaleFactor(result, {
				type: "factor",
				value: factor,
			});
			return { result: applyScale(result, resolution.factor) };
		}
		return { result };
	} catch (e) {
		return { result, error: e instanceof Error ? e.message : String(e) };
	}
}

import { slugify, cleanObject } from "./utils";
import { applyScale } from "./scale";
import { processSections } from "./processor";
import { generateShoppingList } from "./shopping";
import { calculatePreparationTime } from "./metrics";
import { RecipeRegistry } from "./registry";
import type { RecipeAST } from "@gram-lang/parser";
import type { CompilationResult, Usage } from "./types";

import type { z } from "zod";
import { CompilerOptionsSchema } from "./schemas";

export type CompilerOptions = z.infer<typeof CompilerOptionsSchema>;

/** Main entry point of the Gram compiler. */
export function compile(
	ast: RecipeAST,
	rawOptions?: CompilerOptions,
): CompilationResult {
	const options = CompilerOptionsSchema.parse(rawOptions || {});
	if (ast.type !== "Recipe") throw new Error("Compiler expects Recipe AST");

	const registry = new RecipeRegistry();

	const resultPayload = processSections(ast.children, registry, options);
	const sections = resultPayload.sections;

	const shopping_list = generateShoppingList(sections, registry, options);

	const globalCookware: Usage[] = [];
	sections.forEach((sec) => {
		sec.cookware.forEach((cw) => {
			if (!cw.modifiers?.includes("reference")) {
				globalCookware.push(cw);
			}
		});
	});

	let bakersRefFound = false;
	sections.forEach((sec) => {
		sec.ingredients.forEach((ing) => {
			if (ing.modifiers?.includes("bakers_percentage")) {
				if (bakersRefFound) {
					throw new Error(
						"MULTIPLE_BAKERS_PERCENTAGE: Only one ingredient can be marked with the baker's percentage (*) modifier in a recipe.",
					);
				}
				bakersRefFound = true;
			}
		});
	});

	// Frontmatter's `title` is conventionally a plain string; Meta's type
	// (string | string[], see parser finding I3(3)) is wider only because
	// other frontmatter keys (e.g. `tags`) can be lists.
	const titleValue = ast.meta.title;
	const title = typeof titleValue === "string" ? titleValue : null;

	const result: CompilationResult = {
		title,
		slug: title ? slugify(title) : null,
		// Cloned defensively: compile() must never mutate the caller's AST,
		// since applyScale (and future in-place enrichers) writes to `meta`.
		meta: { ...ast.meta },
		registry: registry.toPlainObject(),
		shopping_list,
		cookware: globalCookware,
		sections,
		warnings: registry.warnings,
		metrics: (() => {
			const prepRes = calculatePreparationTime(sections, registry);
			return {
				totalTime:
					prepRes.total +
					resultPayload.metrics.idleTime +
					resultPayload.metrics.activeTime,
				totalBreakdown: resultPayload.metrics.totalBreakdown,
				idleTime: resultPayload.metrics.idleTime,
				activeTime: resultPayload.metrics.activeTime,
				activeBreakdown: resultPayload.metrics.activeBreakdown,
				preparationTime: prepRes.total,
				prepBreakdown: prepRes.breakdown,
			};
		})(),
	};

	const scaled =
		options.scaleFactor && options.scaleFactor !== 1
			? applyScale(result, options.scaleFactor)
			: result;

	// cleanObject only prunes null/undefined fields — the shape stays
	// CompilationResult, just with those keys absent instead of null.
	return cleanObject(scaled) as CompilationResult;
}

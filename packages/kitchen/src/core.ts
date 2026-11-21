import { slugify, cleanObject } from "./utils";
import { applyScale } from "./scale";
import { processSections } from "./processor";
import { generateShoppingList } from "./shopping";
import { KITCHEN_VERSION } from "./version";
import { RecipeRegistry } from "./registry";
import type { RecipeAST } from "@gram-lang/parser";
import type { CompilationResult, ProcessedSection, Usage } from "./types";
import { pushWarning, WarningCode } from "./warnings";

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

	const resultPayload = processSections(
		ast.children,
		registry,
		options,
		ast.imports,
	);
	const sections = resultPayload.sections;

	keepOneBakersReference(sections, registry);

	const shopping_list = generateShoppingList(sections, registry, options);

	const globalCookware: Usage[] = [];
	sections.forEach((sec) => {
		sec.cookware.forEach((cw) => {
			if (!cw.modifiers?.includes("reference")) {
				globalCookware.push(cw);
			}
		});
	});

	// Frontmatter's `title` is conventionally a plain string; Meta's type
	// (string | string[], see parser finding I3(3)) is wider only because
	// other frontmatter keys (e.g. `tags`) can be lists.
	const titleValue = ast.meta.title;
	const title = typeof titleValue === "string" ? titleValue : null;

	const result: CompilationResult = {
		generator: `@gram-lang/kitchen@${KITCHEN_VERSION}`,
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
			const prepRes = resultPayload.preparation;
			// @remove-in: 2.0.0 [kitchen-metrics-times, kitchen-metrics-active-time, kitchen-metrics-breakdowns]
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
		miseEnPlace: resultPayload.miseEnPlace,
		tasks: resultPayload.tasks,
		schedule: resultPayload.schedule,
	};

	const scaled =
		options.scaleFactor && options.scaleFactor !== 1
			? applyScale(result, options.scaleFactor)
			: result;

	// cleanObject only prunes null/undefined fields — the shape stays
	// CompilationResult, just with those keys absent instead of null.
	return cleanObject(scaled) as CompilationResult;
}

/**
 * A recipe has one baker's-percentage base (`*`). The first ingredient
 * marked keeps it; another ingredient marked too loses its `*` with a
 * MULTIPLE_BAKERS_PERCENTAGE warning, before the shopping list carries the
 * marks on, so the analyzer finds a single base. The same ingredient marked
 * again is the same base: nothing to say.
 */
function keepOneBakersReference(
	sections: ProcessedSection[],
	registry: RecipeRegistry,
): void {
	let referenceId: string | null = null;
	const warned = new Set<string>();
	for (const sec of sections) {
		for (const ing of sec.ingredients) {
			if (!ing.modifiers?.includes("bakers_percentage")) continue;
			if (referenceId === null || referenceId === ing.id) {
				referenceId = ing.id;
				continue;
			}
			ing.modifiers = ing.modifiers.filter((m) => m !== "bakers_percentage");
			if (ing.modifiers.length === 0) delete ing.modifiers;
			if (warned.has(ing.id)) continue;
			warned.add(ing.id);
			pushWarning(registry, WarningCode.MULTIPLE_BAKERS_PERCENTAGE, {
				item: ing.name ?? ing.id,
				reference: registry.ingredients.get(referenceId)?.name ?? referenceId,
			});
		}
	}
}

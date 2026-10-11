import {
	toMarkdown,
	toPrintHTML,
	type RendererOptions,
} from "@gram-lang/renderer";
import { runPipeline } from "../core/pipeline";
import { type PlanContext, workPlanFor } from "./plan-options";
import type { IngredientData } from "@gram-lang/analyzer";

// bakersReference/lang are analyzer concerns (which ingredient is the 100%
// base; the recipe's language for unit disambiguation), not renderer
// options — the renderer only reads the already-computed per-item
// `bakersPercentage` — so they're threaded through separately and only
// forwarded to the pipeline, not into RendererOptions.
export type ExportOptions = Pick<
	RendererOptions,
	"hideStepQty" | "bakersMathOnly" | "nutritionBasis" | "miseEnPlace" | "rests"
> & {
	/** When it is served: what the work plan written after the recipe is made for. */
	plan?: PlanContext;
	/** With a `plan`: also write the work plan after the recipe. */
	withSheet?: boolean;
	bakersReference?: string;
	lang?: string;
	paths?: Record<string, string>;
	stock?: Set<string>;
	/** Told which `stock` entries a `@use` of the recipe matched, once known. */
	onUsedStock?: (used: Set<string>) => void;
};

export async function exportRecipe(
	filePath: string,
	format: "md" | "html",
	db: Record<string, IngredientData> | null,
	scaleFactor?: number,
	rendererOptions?: ExportOptions,
): Promise<string> {
	const { compiled, analyzed, usedStock } = await runPipeline(filePath, {
		db,
		scaleFactor,
		bakersReference: rendererOptions?.bakersReference,
		lang: rendererOptions?.lang,
		paths: rendererOptions?.paths,
		stock: rendererOptions?.stock,
	});
	rendererOptions?.onUsedStock?.(usedStock);

	const ast = analyzed ? analyzed.result : compiled;
	const plan = rendererOptions?.plan;
	const { plan: _plan, withSheet, ...rest } = rendererOptions ?? {};
	const options: RendererOptions = {
		...rest,
		...(plan &&
			withSheet && {
				runSheet: workPlanFor(compiled, plan, {
					miseEnPlace: rendererOptions?.miseEnPlace,
					rests: rendererOptions?.rests,
				}),
			}),
	};

	if (format === "md") return toMarkdown(ast, options);
	return toPrintHTML(ast, options);
}

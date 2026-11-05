import {
	prepareViews,
	runSheetToMarkdown,
	runSheetToPrintHTML,
	toMarkdown,
	toPrintHTML,
	type RecipeSettings,
	type RendererOptions,
} from "@gram-lang/renderer";
import { runPipeline } from "../core/pipeline";
import { ExitCode, GramCLIError } from "../errors";
import type { ExportView } from "./plan-options";
import type { IngredientData } from "@gram-lang/analyzer";

// bakersReference/lang are analyzer concerns (which ingredient is the 100%
// base; the recipe's language for unit disambiguation), not renderer
// options — the renderer only reads the already-computed per-item
// `bakersPercentage` — so they're threaded through separately and only
// forwarded to the pipeline, not into RendererOptions.
export type ExportOptions = Pick<
	RendererOptions,
	| "hideStepQty"
	| "bakersMathOnly"
	| "nutritionBasis"
	| "miseEnPlace"
	| "rests"
	| "comments"
> & {
	/** Which view to write, and for the work plan, the kitchen and when it is served. Default: the recipe. */
	view?: ExportView;
	bakersReference?: string;
	/** What the analyzer computes. Default: everything, as the engine. */
	recipe?: RecipeSettings;
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
		recipe: rendererOptions?.recipe,
		lang: rendererOptions?.lang,
		paths: rendererOptions?.paths,
		stock: rendererOptions?.stock,
	});
	rendererOptions?.onUsedStock?.(usedStock);

	const view = rendererOptions?.view ?? { view: "recipe" };
	if (view.view === "workPlan") {
		const sheet = prepareViews(
			compiled,
			{
				miseEnPlace: rendererOptions?.miseEnPlace,
				rests: rendererOptions?.rests,
			},
			{
				kitchen: view.kitchen,
				...(view.serveAt !== undefined && { serveAt: view.serveAt }),
			},
		).runSheet;
		if (!sheet) {
			throw new GramCLIError(
				"This recipe has nothing to plan.",
				ExitCode.Error,
			);
		}
		const options = {
			lang: rendererOptions?.lang,
			comments: rendererOptions?.comments,
		};
		if (format === "md") return runSheetToMarkdown(sheet, compiled, options);
		return runSheetToPrintHTML(sheet, compiled, options);
	}

	const ast = analyzed ? analyzed.result : compiled;
	const {
		view: _view,
		recipe: _recipe,
		bakersReference: _bakersReference,
		paths: _paths,
		stock: _stock,
		onUsedStock: _onUsedStock,
		...options
	} = rendererOptions ?? {};

	if (format === "md") return toMarkdown(ast, options);
	return toPrintHTML(ast, options);
}

import {
	toMarkdown,
	toPrintHTML,
	type RendererOptions,
} from "@gram-lang/renderer";
import { runPipeline } from "../core/pipeline";
import type { IngredientData } from "@gram-lang/analyzer";

export async function exportRecipe(
	filePath: string,
	format: "md" | "html",
	db: Record<string, IngredientData> | null,
	scaleFactor?: number,
	// bakersReference/lang are analyzer concerns (which ingredient is the 100%
	// base; the recipe's language for unit disambiguation), not renderer
	// options — the renderer only reads the already-computed per-item
	// `bakersPercentage` — so they're threaded through separately here and
	// only forwarded to the pipeline below, not into RendererOptions.
	rendererOptions?: Pick<
		RendererOptions,
		"hideStepQty" | "bakersMathOnly" | "nutritionBasis"
	> & {
		bakersReference?: string;
		lang?: string;
		paths?: Record<string, string>;
		stock?: Set<string>;
	},
): Promise<string> {
	const { compiled, analyzed } = await runPipeline(filePath, {
		db,
		scaleFactor,
		bakersReference: rendererOptions?.bakersReference,
		lang: rendererOptions?.lang,
		paths: rendererOptions?.paths,
		stock: rendererOptions?.stock,
	});

	const ast = analyzed ? analyzed.result : compiled;

	if (format === "md") return toMarkdown(ast, rendererOptions);
	return toPrintHTML(ast, rendererOptions);
}

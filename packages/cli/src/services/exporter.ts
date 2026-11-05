import {
	type Format,
	prepareViews,
	type RecipeSettings,
	type ViewSettings,
} from "@gram-lang/renderer";
import { runPipeline } from "../core/pipeline";
import { cliViewName } from "../core/cli-views";
import { ExitCode, GramCLIError } from "../errors";
import { getView } from "@gram-lang/renderer";
import type { ExportView } from "./plan-options";
import type { IngredientData } from "@gram-lang/analyzer";

// bakersReference/lang are analyzer concerns (which ingredient is the 100%
// base; the recipe's language for unit disambiguation), not view settings:
// the views only read the already-computed per-item `bakersPercentage`, so
// they're threaded through separately and only forwarded to the pipeline.
export interface ExportOptions {
	/** What the view shows (`--comments`, `--mise-en-place`, ...). Default: the defaults. */
	settings?: Partial<ViewSettings>;
	/** Which view to write, and for a planned one, the kitchen and when it is served. Default: the recipe. */
	view?: ExportView;
	bakersReference?: string;
	/** What the analyzer computes. Default: everything, as the engine. */
	recipe?: RecipeSettings;
	lang?: string;
	paths?: Record<string, string>;
	stock?: Set<string>;
	/** Told which `stock` entries a `@use` of the recipe matched, once known. */
	onUsedStock?: (used: Set<string>) => void;
}

/**
 * One view of a recipe file, in one of the renderer's formats: the recipe by
 * default, or the view `options.view` names. The caller checks the view has
 * the format (`resolveCliFormat`).
 */
export async function exportRecipe(
	filePath: string,
	format: Format,
	db: Record<string, IngredientData> | null,
	scaleFactor?: number,
	options: ExportOptions = {},
): Promise<string> {
	const { compiled, analyzed, usedStock } = await runPipeline(filePath, {
		db,
		scaleFactor,
		bakersReference: options.bakersReference,
		recipe: options.recipe,
		lang: options.lang,
		paths: options.paths,
		stock: options.stock,
	});
	options.onUsedStock?.(usedStock);

	const view = options.view?.view ?? getView("recipe");
	if (!view) throw new Error("The renderer has no recipe view.");
	const planned = options.view?.kitchen !== undefined;
	// A view laid out in time reads the tasks of the compiled recipe; the
	// others show what the analyzer added (masses, nutrition).
	const input = prepareViews(
		planned ? compiled : (analyzed?.result ?? compiled),
		options.settings,
		{
			...(options.lang !== undefined && { lang: options.lang }),
			...(options.view?.kitchen && { kitchen: options.view.kitchen }),
			...(options.view?.serveAt !== undefined && {
				serveAt: options.view.serveAt,
			}),
		},
	);
	const written = view.render(input, format, {
		...(options.lang !== undefined && { lang: options.lang }),
	});
	if (written === null) {
		throw new GramCLIError(
			planned
				? "This recipe has nothing to plan."
				: `This recipe has nothing to show in the ${cliViewName(view.id)} view.`,
			ExitCode.Error,
		);
	}
	return written;
}

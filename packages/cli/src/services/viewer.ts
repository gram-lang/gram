import { basename } from "node:path";
import type { IngredientData } from "@gram-lang/analyzer";
import {
	getView,
	prepareViews,
	type RecipeSettings,
	type TextStyle,
	type ViewSettings,
} from "@gram-lang/renderer";
import { runPipeline } from "../core/pipeline";

export interface ViewOptions {
	db?: Record<string, IngredientData> | null;
	scaleFactor?: number;
	bakersReference?: string;
	/** What the analyzer computes. Default: everything, as the engine. */
	recipe?: RecipeSettings;
	/** What the view shows (`--comments`, `--mise-en-place`, ...). Default: the defaults. */
	settings?: Partial<ViewSettings>;
	lang?: string;
	paths?: Record<string, string>;
	stock?: Set<string>;
	/** The width of the title box and the rules. Default: the renderer's. */
	width?: number;
	/** The colors of the terminal. Default: plain text. */
	textStyle?: TextStyle;
}

export interface ViewedRecipe {
	/** The recipe in the renderer's `text` format. */
	text: string;
	/** The `stock` entries a `@use` of the recipe matched. */
	usedStock: Set<string>;
	/** The total time of the schedule the view followed, in minutes. */
	totalMinutes: number;
	/** The ingredients the database has no nutrition for (empty without a database). */
	missingIngredients: string[];
}

/**
 * A recipe file as the terminal shows it: the recipe view of the renderer in
 * its `text` format, the same pipeline as `gram export`. What is not the
 * recipe (the scale warnings, the missing nutrition notice) is the command's.
 */
export async function viewRecipe(
	file: string,
	options: ViewOptions = {},
): Promise<ViewedRecipe> {
	const { compiled, analyzed, usedStock } = await runPipeline(file, {
		db: options.db,
		scaleFactor: options.scaleFactor,
		bakersReference: options.bakersReference,
		recipe: options.recipe,
		lang: options.lang,
		paths: options.paths,
		stock: options.stock,
	});

	const view = getView("recipe");
	if (!view) throw new Error("The renderer has no recipe view.");
	const analyzedOrCompiled = analyzed?.result ?? compiled;
	// A recipe with no title is called by its file name.
	const data = analyzedOrCompiled.title
		? analyzedOrCompiled
		: { ...analyzedOrCompiled, title: basename(file, ".gram") };
	const input = prepareViews(data, options.settings, {
		...(options.lang !== undefined && { lang: options.lang }),
	});
	const text = view.render(input, "text", {
		...(options.lang !== undefined && { lang: options.lang }),
		...(options.width !== undefined && { width: options.width }),
		...(options.textStyle && { textStyle: options.textStyle }),
	});

	return {
		text: text ?? "",
		usedStock,
		totalMinutes: input.times.totalTime,
		missingIngredients: analyzed?.missingIngredients ?? [],
	};
}

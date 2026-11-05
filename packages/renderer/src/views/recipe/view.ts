import type { Format, SurfaceOptions, ViewDefinition } from "../../contract";
import type { ViewInput } from "../../prepare-views";
import { viewSettingsToRendererOptions } from "../../settings";
import { htmlBackend } from "./html";
import { markdownBackend } from "./markdown";
import { printBackend } from "./print";
import { type RenderBackend, renderRecipe } from "./traversal";

const BACKENDS: Partial<Record<Format, RenderBackend>> = {
	html: htmlBackend,
	markdown: markdownBackend,
	print: printBackend,
};

/** The recipe: what to buy, what to use, and the steps. */
export const recipeView = {
	id: "recipe",
	kind: "renderer",
	formats: ["html", "markdown", "print"],
	honors: [
		"miseEnPlace",
		"rests",
		"comments",
		"nutritionBasis",
		"bakersMathOnly",
		"stepQuantities",
	],
	needs: ["schedule"],
	render(input: ViewInput, format: Format, surface: SurfaceOptions = {}) {
		const backend = BACKENDS[format];
		if (!backend) {
			throw new RangeError(`The recipe view has no "${format}" format.`);
		}
		const lang = surface.lang ?? input.lang;
		return renderRecipe(
			input.recipe,
			{
				...surface,
				...viewSettingsToRendererOptions(input.settings),
				...(lang !== undefined && { lang }),
			},
			backend,
			input,
		);
	},
} as const satisfies ViewDefinition;

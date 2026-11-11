import type { RendererOptions, RenderableCompilationResult } from "../../types";
import type { RenderBackend } from "./traversal";
import { renderRecipe } from "./traversal";
import { escapeHtml } from "../../shared/utils";
import { stripTooltips } from "../../shared/tooltip-card";
import { getDictionary } from "@gram-lang/i18n";
import { PRINT_BASE_CSS } from "../../shared/print-css";
import { htmlBackend } from "./html";
import css from "./print.css" with { type: "text" };

/** The print stylesheet of the recipe: the base of every printed view, then the recipe's own (`print.css`). */
export const PRINT_CSS: string = PRINT_BASE_CSS + css;

/**
 * On paper, the recipe is the one of the screen, as the run sheet is: the
 * same markup (`html.ts`), set for a page by `print.css`. Nothing to click
 * on paper, so no stepper for the portions; and the classes are the
 * renderer's own, the ones `print.css` styles, not a host's.
 */
function onPaper(options: RendererOptions): RendererOptions {
	return { ...options, classes: undefined, interactiveScaling: false };
}

export const printBackend: RenderBackend = {
	buildContext: (data, options) => ({
		...htmlBackend.buildContext(data, onPaper(options)),
		paper: true,
	}),
	renderTitle: (data, context, options) =>
		htmlBackend.renderTitle(data, context, onPaper(options)),
	renderMeta: (data, context, options) =>
		htmlBackend.renderMeta(data, context, onPaper(options)),
	renderShoppingList: (data, context, options) =>
		htmlBackend.renderShoppingList(data, context, onPaper(options)),
	renderCookware: (data, context, options) =>
		htmlBackend.renderCookware(data, context, onPaper(options)),
	renderInstructions: (data, context, options) =>
		htmlBackend.renderInstructions(data, context, onPaper(options)),
	renderFootnotes: (data, context, options) =>
		htmlBackend.renderFootnotes(data, context, onPaper(options)),
	renderNutrition: (data, context, options) =>
		htmlBackend.renderNutrition(data, context, onPaper(options)),

	assembleDocument(sections, data, context, options) {
		// No tooltips on paper: the step elements and badges keep only their text.
		const body = stripTooltips(
			htmlBackend.assembleDocument(sections, data, context, onPaper(options)),
		);
		const title =
			data.title ||
			getDictionary(options.lang).renderer.outputs.recipe ||
			"Recipe";
		return `<!DOCTYPE html>
<html lang="${escapeHtml(String(data.meta?.language ?? options.lang ?? "en"))}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
${body}</body>
</html>`;
	},
};

export function toPrintHTML(
	data: RenderableCompilationResult,
	options: RendererOptions = {},
): string {
	return renderRecipe(data, options, printBackend);
}

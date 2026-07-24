import type {
	RendererOptions,
	RenderContext,
	RenderableCompilationResult,
} from "./types";

/**
 * Audit 2026-07-22, renderer finding I-4/P-1 (Phase 11): html.ts/markdown.ts/
 * print.ts used to each hand-roll their own top-level document assembly, with
 * no structural guarantee they covered the same set of sections in the same
 * order — that's exactly how Phase 9's `hideStepQty` bug happened (wired into
 * print.ts's context but silently forgotten in html.ts/markdown.ts).
 *
 * A `RenderBackend` is required to implement every section hook below, so a
 * newly-added section can't be silently missing from one backend the way
 * `hideStepQty` was: TypeScript enforces the hook exists, even if a backend's
 * implementation is currently a no-op (e.g. markdown's nutrition/footnotes
 * hooks — see markdown.ts). Whether a hook actually emits anything for a
 * given recipe (e.g. "only if shopping_list is non-empty") remains each
 * backend's own decision, preserved exactly as it was before this refactor —
 * this traversal does not itself decide what's visible, only that every
 * backend is asked, in the same order, with the same shared context.
 */
export interface RenderSections {
	title: string;
	meta: string;
	shoppingList: string;
	cookware: string;
	instructions: string;
	footnotes: string;
	nutrition: string;
}

export interface RenderBackend {
	buildContext(
		data: RenderableCompilationResult,
		options: RendererOptions,
	): RenderContext;
	renderTitle(
		data: RenderableCompilationResult,
		context: RenderContext,
		options: RendererOptions,
	): string;
	renderMeta(
		data: RenderableCompilationResult,
		context: RenderContext,
		options: RendererOptions,
	): string;
	renderShoppingList(
		data: RenderableCompilationResult,
		context: RenderContext,
		options: RendererOptions,
	): string;
	renderCookware(
		data: RenderableCompilationResult,
		context: RenderContext,
		options: RendererOptions,
	): string;
	renderInstructions(
		data: RenderableCompilationResult,
		context: RenderContext,
		options: RendererOptions,
	): string;
	/**
	 * Called after `renderInstructions` — footnote-style backends (html.ts)
	 * accumulate their footnote text as a side effect of rendering inline
	 * comments during instructions (`context._inlineComments`), so this hook
	 * must run after instructions to see the populated list.
	 */
	renderFootnotes(
		data: RenderableCompilationResult,
		context: RenderContext,
		options: RendererOptions,
	): string;
	renderNutrition(
		data: RenderableCompilationResult,
		context: RenderContext,
		options: RendererOptions,
	): string;
	assembleDocument(
		sections: RenderSections,
		data: RenderableCompilationResult,
		context: RenderContext,
		options: RendererOptions,
	): string;
}

export function renderRecipe(
	data: RenderableCompilationResult,
	options: RendererOptions,
	backend: RenderBackend,
): string {
	const context = backend.buildContext(data, options);

	const title = backend.renderTitle(data, context, options);
	const meta = backend.renderMeta(data, context, options);
	const shoppingList = backend.renderShoppingList(data, context, options);
	const cookware = backend.renderCookware(data, context, options);
	const instructions = backend.renderInstructions(data, context, options);
	// Must run after instructions — see renderFootnotes's own doc comment.
	const footnotes = backend.renderFootnotes(data, context, options);
	const nutrition = backend.renderNutrition(data, context, options);

	return backend.assembleDocument(
		{ title, meta, shoppingList, cookware, instructions, footnotes, nutrition },
		data,
		context,
		options,
	);
}

import type { CommentsMode, RenderableCompilationResult } from "../types";

/** Whether comments are shown: they are unless a view says `"hide"`. */
export const showsComments = (mode?: CommentsMode) => mode !== "hide";

/**
 * The recipe without its comments: the notes alone on a line and the ones at
 * the end of a line, which a view would turn into footnotes. Everything else,
 * numbering included, is untouched: a comment is never counted as a step.
 */
export function withoutComments(
	data: RenderableCompilationResult,
): RenderableCompilationResult {
	return {
		...data,
		sections: (data.sections ?? []).map((section) => ({
			...section,
			steps: section.steps
				.filter((step) => step.type !== "comment")
				.map((step) =>
					step.type === "step"
						? {
								...step,
								content: step.content.filter(
									(token) =>
										!(typeof token === "object" && token.type === "comment"),
								),
							}
						: step,
				),
		})),
	} as RenderableCompilationResult;
}

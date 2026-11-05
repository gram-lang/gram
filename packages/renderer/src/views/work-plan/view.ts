import type { Format, SurfaceOptions, ViewDefinition } from "../../contract";
import type { ViewInput } from "../../prepare-views";
import type { RenderableCompilationResult } from "../../types";
import type { RunSheet } from "@gram-lang/scheduler";
import type { RunSheetRenderOptions } from "./model";
import { runSheetToHTML } from "./html";
import { runSheetToMarkdown } from "./markdown";
import { runSheetToPrintHTML } from "./print";
import { runSheetToText } from "./text";

type Writer = (
	sheet: RunSheet,
	data: RenderableCompilationResult,
	options: RunSheetRenderOptions,
) => string;

const WRITERS: Record<Format, Writer> = {
	html: runSheetToHTML,
	markdown: runSheetToMarkdown,
	text: runSheetToText,
	print: runSheetToPrintHTML,
};

/** The work plan: the days, the visits to the kitchen, what to take out and what to do. */
export const workPlanView = {
	id: "workPlan",
	kind: "renderer",
	formats: ["html", "markdown", "text", "print"],
	honors: ["miseEnPlace", "rests", "comments"],
	needs: ["runSheet"],
	render(input: ViewInput, format: Format, surface: SurfaceOptions = {}) {
		const write = WRITERS[format];
		if (!write) {
			throw new RangeError(`The work plan view has no "${format}" format.`);
		}
		const sheet = input.runSheet;
		if (!sheet) return null;
		const lang = surface.lang ?? input.lang;
		return write(sheet, input.recipe, {
			comments: input.settings.comments,
			...(lang !== undefined && { lang }),
			...(surface.formatDuration && { formatDuration: surface.formatDuration }),
		});
	},
} as const satisfies ViewDefinition;

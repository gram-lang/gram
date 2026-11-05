import { PRINT_CSS } from "../recipe/print";
import { type RunSheetRenderOptions, describeRunSheet } from "./model";
import { runSheetToHTML } from "./html";
import { RUN_SHEET_PRINT_CSS } from "./print-css";
import type { RenderableCompilationResult } from "../../types";
import { escapeHtml } from "../../shared/utils";
import type { RunSheet } from "@gram-lang/scheduler";

/** The production sheet as a complete, print-ready HTML document. */
export function runSheetToPrintHTML(
	sheet: RunSheet,
	data: RenderableCompilationResult,
	options: RunSheetRenderOptions = {},
): string {
	const model = describeRunSheet(sheet, data, options);
	return `<!DOCTYPE html>
<html lang="${escapeHtml(options.lang || "en")}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(model.title)}</title>
  <style>${PRINT_CSS}${RUN_SHEET_PRINT_CSS}</style>
</head>
<body>
${runSheetToHTML(sheet, data, options)}</body>
</html>`;
}

export * from "./types";
// Shared by the three backends and by consumers that render nutrition
// themselves (the CLI's terminal view), so the choice of basis and the set of
// nutrient rows stay identical across every surface.
export {
	availableBases,
	hasNutritionToShow,
	nutritionGroups,
	nutritionRows,
	resolveNutritionBasis,
} from "./nutrition";
export type { NutrientGroup, NutrientRow, ResolvedBasis } from "./nutrition";
export { formatElement, DEFAULT_ICONS } from "./formatters/element";
export { toMarkdown } from "./formatters/markdown";
export { toHTML } from "./formatters/html";
export { toPrintHTML } from "./formatters/print";
export {
	formatDecimalToFraction,
	getQty,
	formatQuantityValue,
	formatDuration,
	escapeHtml,
	escapeMarkdownHtml,
	joinStepTokens,
} from "./utils";
export {
	toGanttHTML,
	attachGanttInteractivity,
	formatTime,
	formatAxisTime,
} from "./gantt";
export type {
	GanttRenderOptions,
	GanttInteractivityOptions,
	GanttInteractivityHandle,
	GanttTimeMode,
} from "./gantt";

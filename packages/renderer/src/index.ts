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
} from "./shared/nutrition";
export { timesOf } from "./shared/mise-en-place";
export { prepareViews } from "./prepare-views";
export { FORMAT_DEFINITIONS, FORMATS } from "./contract";
export type {
	Capability,
	Format,
	FormatDefinition,
	InspectorDefinition,
	OutputBase,
	OutputDefinition,
	SettingKey,
	Stage,
	StageArtifacts,
	SurfaceOptions,
	ViewDefinition,
} from "./contract";
export { getView, render, views } from "./views/registry";
export type { ViewId } from "./views/registry";
export {
	astInspector,
	getInspector,
	inspectors,
	jsonInspector,
	jsonTreeInspector,
} from "./inspectors/registry";
export type { InspectorId } from "./inspectors/registry";
export { JSON_TREE_CSS, renderJsonTree } from "./inspectors/json-tree";
export type { JsonTreeOptions } from "./inspectors/json-tree";
export { renderSExpr } from "./inspectors/s-expr";
export { outputs } from "./outputs";
export { describeError } from "./describe-error";
export type {
	DescribableDiagnostic,
	ErrorDescription,
} from "./describe-error";
export type { OutputId } from "./outputs";
export type {
	KitchenContext,
	PrepareViewsOptions,
	ViewInput,
	ViewSchedule,
} from "./prepare-views";
export {
	COMMENTS_MODES,
	DEFAULT_RECIPE_SETTINGS,
	DEFAULT_VIEW_SETTINGS,
	NUTRITION_BASES,
	RECIPE_SETTINGS,
	SETTINGS,
	STEP_QUANTITIES_MODES,
	VIEW_SETTINGS,
	parseRecipeSettings,
	parseViewSettings,
	recipeSettingsToAnalyzerOptions,
	viewSettingsToRendererOptions,
} from "./settings";
export type {
	AnySetting,
	ChoiceSetting,
	FlagSetting,
	RecipeSettings,
	SettingDescriptor,
	SettingKind,
	StepQuantitiesMode,
	ViewSettings,
} from "./settings";
export type {
	NutrientGroup,
	NutrientRow,
	ResolvedBasis,
} from "./shared/nutrition";
export { type ElementFormat, formatElement } from "./shared/element";
export {
	DEFAULT_ICONS,
	HTML_ICONS,
	MD_ICONS,
	PRINT_ICONS,
} from "./shared/icons";
export { toMarkdown } from "./views/recipe/markdown";
export type { CommentsMode } from "./types";
export { toHTML } from "./views/recipe/html";
export { attachTooltips, TOOLTIP_SCRIPT } from "./shared/tooltip";
export { toPrintHTML } from "./views/recipe/print";
export { DEFAULT_TEXT_WIDTH, toText } from "./views/recipe/text";
export { describeRunSheet } from "./views/run-sheet/model";
export { runSheetToHTML } from "./views/run-sheet/html";
export { runSheetToMarkdown } from "./views/run-sheet/markdown";
export { runSheetToText } from "./views/run-sheet/text";
export { runSheetToPrintHTML } from "./views/run-sheet/print";
export {
	describeEarliestServe,
	describeServeTimes,
	type ServeSuggestion,
	type ServeSuggestions,
	type SuggestServeOptions,
	suggestServeTimes,
} from "./views/run-sheet/serve-times";
export type {
	RunSheetDayModel,
	RunSheetEvent,
	RunSheetKitGroup,
	RunSheetKitLine,
	RunSheetVisitModel,
	RunSheetProgramLine,
	RunSheetModel,
	RunSheetRenderOptions,
	RunSheetScheduleRow,
	RunSheetStepLine,
	RunSheetWaitLine,
} from "./views/run-sheet/model";
export {
	intermediateMakers,
	visitKit,
	sectionProgram,
	sectionSteps,
} from "./views/run-sheet/parts";
export type {
	KitItem,
	ProgramStep,
	VisitKitOptions,
	SectionProgram,
} from "./views/run-sheet/parts";
export {
	formatDecimalToFraction,
	getQty,
	formatQuantityValue,
	formatDuration,
	formatTimer,
	toCommonFraction,
	escapeHtml,
	escapeMarkdownHtml,
	joinStepTokens,
} from "./shared/utils";
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

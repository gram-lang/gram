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
export { formatElement } from "./shared/element";
export {
	DEFAULT_ICONS,
	HTML_ICONS,
	MD_ICONS,
	PRINT_ICONS,
} from "./shared/icons";
export { toMarkdown } from "./views/recipe/markdown";
export type { CommentsMode } from "./types";
export { toHTML } from "./views/recipe/html";
export { toPrintHTML } from "./views/recipe/print";
export { describeRunSheet } from "./views/work-plan/model";
export { runSheetToHTML } from "./views/work-plan/html";
export { runSheetToMarkdown } from "./views/work-plan/markdown";
export { runSheetToText } from "./views/work-plan/text";
export { runSheetToPrintHTML } from "./views/work-plan/print";
export {
	describeEarliestServe,
	describeServeTimes,
} from "./views/work-plan/serve-times";
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
} from "./views/work-plan/model";
export {
	intermediateMakers,
	visitKit,
	sectionProgram,
	sectionSteps,
} from "./views/work-plan/parts";
export type {
	KitItem,
	ProgramStep,
	VisitKitOptions,
	SectionProgram,
} from "./views/work-plan/parts";
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

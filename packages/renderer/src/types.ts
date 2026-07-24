import type { CompilationResult } from "@gram-lang/kitchen";
import type {
	AnalyzedCompilationResult,
	MassMetrics,
	NutritionMetrics,
} from "@gram-lang/analyzer";

// Audit 2026-07-22, renderer finding I-6: the three public entry points
// (toHTML/toMarkdown/toPrintHTML) declared `data: any` — the only stage of
// the pipeline that didn't type its input, even though the exact upstream
// shape was already exported. A recipe reaches the renderer either straight
// out of `compile()` (no ingredient database — mass/nutrition fields absent)
// or out of `analyze()` (enriched with mass standardization and nutrition) —
// both are valid, tested inputs (see e.g. xss-escaping.test.ts using the
// former), so the renderer's real contract is the union of both, not either
// alone.
export type RenderableCompilationResult =
	| CompilationResult
	| AnalyzedCompilationResult;

// `data.metrics` for a plain (un-analyzed) CompilationResult never carries
// mass/nutrition fields at all — narrowing the union member-by-member at
// every one of the many read sites below would bury the actual formatting
// logic in "in" checks, so this models the true runtime contract directly:
// the base timing fields are always present, the analyzer-only ones are
// optional. One cast to this type per formatter (at `data.metrics`) is the
// single, justified narrowing point — same pattern as the parser's `getOpt`.
export type RenderableMetrics = CompilationResult["metrics"] &
	Partial<MassMetrics> & { nutrition?: NutritionMetrics };

export interface RendererIcons {
	hourglass?: string;
	timer?: string;
	thermometer?: string;
	caretRight?: string;
	arrowRight?: string;
	arrowUDownLeft?: string;
	warning?: string;
	pencilSimple?: string;
	clock?: string;
	fire?: string;
	knife?: string;
	scales?: string;
	clockCounterClockwise?: string;
	arrowElbowDownRight?: string;
	info?: string;
	minus?: string;
	plus?: string;
}

export interface RendererClasses {
	recipeTitle?: string;
	recipeMeta?: string;
	recipeTimingsGrid?: string;
	timingCard?: string;
	metaItem?: string;
	metaIcon?: string;
	metaContent?: string;
	metaLabel?: string;
	metaValue?: string;
	metaEst?: string;
	recipeMetaSecondary?: string;
	metadataGrid?: string;
	metaSecondaryItem?: string;
	shoppingList?: string;
	cookwareList?: string;
	instructions?: string;
	sectionHeader?: string;
	sectionIngredients?: string;
	stepsList?: string;
	stepItem?: string;
	stepAction?: string;
	stepComment?: string;
	ingredient?: string;
	reference?: string;
	cookware?: string;
	timer?: string;
	temperature?: string;
	declaration?: string;
	massBadge?: string;
	bakersBadge?: string;
	prepText?: string;
	compositeParentText?: string;
	alternativeGroup?: string;
	optionalText?: string;
	formulaText?: string;
}

export interface RendererOptions {
	icons?: RendererIcons;
	classes?: RendererClasses;
	formatFraction?: (value: number) => string;
	formatDuration?: (minutes: number) => string;
	/** When true, ingredient quantities are omitted from step text (not from shopping list or section mise en place). */
	hideStepQty?: boolean;
	bakersMathOnly?: boolean;
	/** When true, renders interactive controls for scaling portions and ingredients */
	interactiveScaling?: boolean;
	/** Locale code (e.g. 'en', 'fr') for translating UI strings */
	lang?: string;
	/**
	 * Prefix used for footnote anchor ids (e.g. "note-1"). Override this when
	 * rendering multiple recipes on the same page to avoid id collisions.
	 * Defaults to a fixed value, so output is deterministic across calls.
	 */
	renderId?: string;
}

export interface RenderContext {
	registry?: {
		ingredients?: Record<string, any>;
		cookware?: Record<string, any>;
	};
	icons?: RendererIcons;
	classes?: RendererClasses;
	formatFraction?: (value: number) => string;
	formatDuration?: (minutes: number) => string;
	/** Set to true when formatting step tokens to suppress quantity display. */
	hideIngredientQty?: boolean;

	// Passed down from RendererOptions
	bakersMathOnly?: boolean;
	interactiveScaling?: boolean;
	lang?: string;

	/** Controls the display style of elements like ingredient preparations. Default is 'inline'. */
	formatMode?: "inline" | "mise-en-place" | "shopping-list";

	// State for footnotes
	_inlineComments?: string[];
	_renderId?: string;
}

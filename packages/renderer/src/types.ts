import type {
	CompilationResult,
	MiseEnPlaceMode,
	RestChoice,
} from "@gram-lang/kitchen";
import type {
	AnalyzedCompilationResult,
	MassMetrics,
	NutritionMetrics,
} from "@gram-lang/analyzer";

// Traceability badge `@gram-lang/modules`' `finalizeComposed` stamps onto a
// spliced-in section — never set by kitchen's compile() or analyzer's
// analyze() themselves. Kept as a small structural shape here rather than
// importing `@gram-lang/modules`' own `ModuleInfo` type: the renderer
// depends on neither that package nor its types, and this is all three
// recipe views' `moduleLabel()` (views/recipe/module-label.ts) actually needs.
export interface SectionModuleBadge {
	binding: string;
	uri: string;
	title: string | null;
	mode: "inline" | "stocked";
}

type WithModuleBadge<TSection> = TSection & { module?: SectionModuleBadge };

// A recipe reaches the renderer either straight out of `compile()` (no
// ingredient database — mass/nutrition fields absent) or out of `analyze()`
// (enriched with mass standardization and nutrition) — both are valid, tested
// inputs (see e.g. xss-escaping.test.ts using the former), so the renderer's
// real contract is the union of both, not either alone. Either member's
// `sections` may additionally carry the module badge above, when the result
// came from `@gram-lang/modules`' compose pipeline rather than a plain
// single-file compile.
export type RenderableCompilationResult =
	| (Omit<CompilationResult, "sections"> & {
			sections: WithModuleBadge<CompilationResult["sections"][number]>[];
	  })
	| (Omit<AnalyzedCompilationResult, "sections"> & {
			sections: WithModuleBadge<
				AnalyzedCompilationResult["sections"][number]
			>[];
	  });

// `data.metrics` for a plain (un-analyzed) CompilationResult never carries
// mass/nutrition fields at all — narrowing the union member-by-member at
// every one of the many read sites below would bury the actual formatting
// logic in "in" checks, so this models the true runtime contract directly:
// the base timing fields are always present, the analyzer-only ones are
// optional. One cast to this type per formatter (at `data.metrics`) is the
// single, justified narrowing point — same pattern as the parser's `getOpt`.
export type RenderableMetrics = CompilationResult["metrics"] &
	Partial<MassMetrics> & { nutrition?: NutritionMetrics };

/** The keys of NutritionMetrics that hold a Macros profile, plus "auto". */
export type NutritionBasis = "auto" | "total" | "perPortion" | "per100g";

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
	package?: string;
	copy?: string;
	check?: string;
	/** The nutrition pill of the hero bar. */
	chartPie?: string;
	/** The portions of the hero bar. */
	users?: string;
}

export interface RendererClasses {
	recipeTitle?: string;
	recipeDescription?: string;
	recipeHeroBar?: string;
	recipeTimingsBar?: string;
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
	/** A quantity written in the text of a step (default `step-quantity`). */
	stepQuantity?: string;
	bakersBadge?: string;
	prepText?: string;
	compositeParentText?: string;
	alternativeGroup?: string;
	optionalText?: string;
	formulaText?: string;
}

/**
 * Which complete timeline a view follows: preparation right before each
 * section (`perSection`, the default), all of it at the start (`upfront`), or
 * at the start of each working day (`perDay`).
 * Owned by `@gram-lang/kitchen`, re-exported so this import path keeps working.
 */
export type { MiseEnPlaceMode, RestChoice };

/**
 * Whether a view shows the comments of the recipe (`// like this`): the notes
 * alone on a line and the ones at the end of a line. `"show"` is the default.
 */
export type CommentsMode = "show" | "hide";

/**
 * How the `text` format sets parts of the recipe apart, for a surface that can
 * (a terminal's colors, for instance). Each entry wraps a piece of text and
 * returns it, and must not change its visible width: the renderer measures the
 * text before styling it. Every entry left out keeps the text as it is, so the
 * renderer never needs to know about a terminal.
 */
export interface TextStyle {
	/** The title of the recipe. */
	title?: (text: string) => string;
	/** The heading of a part: the shopping list, a section, the nutrition. */
	heading?: (text: string) => string;
	/** What is secondary: rules, step numbers, quantities of a composite, notes. */
	dim?: (text: string) => string;
	ingredient?: (text: string) => string;
	/** An intermediate made in an earlier section (`&dough`). */
	reference?: (text: string) => string;
	cookware?: (text: string) => string;
	timer?: (text: string) => string;
	/** The action of a step (`[Mix]`). */
	action?: (text: string) => string;
}

export interface RendererOptions {
	/** `text` format only: how to set parts apart (colors). Plain by default. */
	textStyle?: TextStyle;
	/** `text` format only: the width of the rules and of the title box. Default 78. */
	width?: number;
	icons?: RendererIcons;
	classes?: RendererClasses;
	formatFraction?: (value: number) => string;
	formatDuration?: (minutes: number) => string;
	/**
	 * Show (`"show"`, the default) or hide (`"hide"`) the comments of the
	 * recipe, in every view: the recipe, the run sheet, and the print.
	 */
	comments?: CommentsMode;
	/** When true, ingredient quantities are omitted from step text (not from shopping list or section mise en place). */
	hideStepQty?: boolean;
	/**
	 * Which timeline to follow: mise en place right before each section
	 * (`"perSection"`, the default), all of it at the start (`"upfront"`), or at
	 * the start of each working day (`"perDay"`). Drives the total and idle
	 * times of the recipe; what to take out, and when, is the run sheet's.
	 */
	miseEnPlace?: MiseEnPlaceMode;
	/**
	 * How long a passive rest written as a range (`~_{12-24h}`) lasts: the
	 * shortest (`"shortest"`, the default), the middle or the longest. An exact
	 * rest and an active timer are unaffected.
	 */
	rests?: RestChoice;
	bakersMathOnly?: boolean;
	/**
	 * @deprecated Since 1.4.0, will be removed in 2.0.0. (Ref: renderer-interactive-scaling)
	 * Shows a portions stepper in the hero bar of the HTML recipe, which works
	 * only where the host page wires its buttons. Scale the recipe before
	 * rendering it instead (`applyScale()` of `@gram-lang/kitchen`, or the surface's
	 * own controls): the view shows the portions and the factor by itself.
	 */
	interactiveScaling?: boolean;
	/**
	 * Which nutrition basis to display. The analyzer computes all of them;
	 * picking one is presentation. "auto" keeps the historical behaviour —
	 * per portion when the recipe declares a portion count, otherwise the
	 * whole recipe — so per-100 g is opt-in.
	 */
	nutritionBasis?: NutritionBasis;
	/**
	 * No longer has any effect: the HTML recipe shows its nutrition as a
	 * table, every basis side by side, so there is no basis switch to turn on.
	 *
	 * @deprecated Since 1.4.0, will be removed in 2.0.0. (Ref: renderer-interactive-nutrition)
	 */
	interactiveNutrition?: boolean;
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
	/** The total and idle time of the chosen schedule, prepared once (`prepareViews`). */
	times?: { totalTime: number; idleTime: number };
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
	/** `text` format only: how to set parts apart (see `TextStyle`). */
	textStyle?: TextStyle;
	/**
	 * `text` format only: in a list (shopping list, ingredients of a section),
	 * the width the name is padded to, so the quantities line up in a column.
	 */
	textColumn?: number;

	// Passed down from RendererOptions
	bakersMathOnly?: boolean;
	// @remove-in: 2.0.0 [renderer-interactive-scaling]
	interactiveScaling?: boolean;
	lang?: string;
	/**
	 * The recipe is printed (`toPrintHTML`, which writes the markup of the
	 * screen): what only a screen can use, a rich tooltip or the copy button,
	 * is left out.
	 */
	paper?: boolean;

	/** Controls the display style of elements like ingredient preparations. Default is 'inline'. */
	formatMode?: "inline" | "mise-en-place" | "shopping-list";

	// State for footnotes
	_inlineComments?: string[];
	_renderId?: string;
}

import type { AnalyzedCompilationResult } from "@gram-lang/analyzer";
import type { CompilationResult } from "@gram-lang/kitchen";
import type { RecipeAST } from "@gram-lang/parser";
import type { ViewInput } from "./prepare-views";
import type { ViewSettings } from "./settings";
import type { RendererOptions } from "./types";

/** The formats a view can be written in. Not every view has every format. */
export type Format = "html" | "markdown" | "text" | "print";

/** Every format, in the order the surfaces offer them. */
export const FORMATS: readonly Format[] = ["html", "markdown", "text", "print"];

/** What a surface needs to know about a format to show it. */
export interface FormatDefinition {
	/**
	 * How a screen shows the written text: as a page (`page`), as highlighted
	 * source (`code`), or not at all (`none`), for a document made for a
	 * printer, not for a pane.
	 */
	display: "page" | "code" | "none";
	/** The highlighting language of a `code` display. */
	language?: string;
}

/**
 * Each format, described once. A `Record` over `Format`: a new format does not
 * compile until it says how a screen shows it, so no surface keeps its own list.
 */
export const FORMAT_DEFINITIONS: Readonly<Record<Format, FormatDefinition>> = {
	html: { display: "page" },
	markdown: { display: "code", language: "markdown" },
	text: { display: "code", language: "text" },
	print: { display: "none" },
};

/** A view setting, by its key. */
export type SettingKey = keyof ViewSettings;

/**
 * The parts of a `ViewInput` that cost something to work out. A surface reads
 * a view's `needs` to know which of them to prepare.
 */
export type Capability = "schedule" | "runSheet" | "serveTimes";

/**
 * What a surface can do, not what the user wants to see: the language, the
 * icons and classes, the interactive toggles. Every renderer option that is
 * not carried by a view setting.
 */
export type SurfaceOptions = Omit<
	RendererOptions,
	| "miseEnPlace"
	| "rests"
	| "comments"
	| "nutritionBasis"
	| "bakersMathOnly"
	| "hideStepQty"
>;

/** What every output has, a view of the recipe or an inspector of the pipeline. */
export interface OutputBase {
	id: string;
	kind: "renderer" | "inspector";
}

/** A view of a recipe: a document, in one of the formats it offers. */
export interface ViewDefinition extends OutputBase {
	kind: "renderer";
	/** The formats this view is written in. */
	formats: readonly Format[];
	/** The view settings this view reacts to. */
	honors: readonly SettingKey[];
	/** The costly parts of the input it reads. */
	needs: readonly Capability[];
	/**
	 * The view in `format`, with the settings of `input`. `null` when the
	 * recipe has nothing for this view (a run sheet of a recipe with no tasks).
	 */
	render(
		input: ViewInput,
		format: Format,
		surface?: SurfaceOptions,
	): string | null;
}

/** What each stage of the pipeline produces, for the inspectors that read it. */
export interface StageArtifacts {
	/** The AST after `@use` resolution (`composeRecipe`). */
	composedAst: RecipeAST;
	compiled: CompilationResult;
	analyzed: AnalyzedCompilationResult;
}

/** A stage of the pipeline an inspector reads. */
export type Stage = keyof StageArtifacts;

/**
 * An inspector: not a view of the recipe but a look at what one stage of the
 * pipeline produced. It takes no view settings, and its output is for a code
 * pane or a tree, not a document of its own.
 */
export interface InspectorDefinition<S extends Stage = Stage>
	extends OutputBase {
	kind: "inspector";
	stage: S;
	/** A code pane (highlighted text) or a tree (`renderJsonTree`'s HTML). */
	presentation: "code" | "tree";
	/** The highlighting of a code pane. */
	language?: "json" | "scheme";
	serialize(artifact: StageArtifacts[S]): string;
}

/** Every output a surface can show: a view or an inspector. */
export type OutputDefinition = ViewDefinition | InspectorDefinition;

import type { AnalyzerOptions } from "@gram-lang/analyzer";
import {
	DEFAULT_MISE_EN_PLACE_MODE,
	DEFAULT_REST_CHOICE,
	MISE_EN_PLACE_MODES,
	type MiseEnPlaceMode,
	REST_CHOICES,
	type RestChoice,
} from "@gram-lang/kitchen";
import type { CommentsMode, NutritionBasis, RendererOptions } from "./types";

/**
 * The settings a user chooses about a recipe, described once so that every
 * surface (CLI flags, `gram.*` keys of the editor, playground options) offers
 * the same ones, with the same values and the same default.
 *
 * - A **view** setting changes what a view shows of an already computed recipe.
 * - A **recipe** setting changes the recipe the analyzer computes, before any
 *   view sees it.
 *
 * Inputs of one session (the serving time, the scale, the stock) are not
 * settings: they are never stored as a preference.
 */
export type SettingKind = "view" | "recipe";

interface SettingBase<V> {
	key: string;
	kind: SettingKind;
	default: V;
	/** One sentence, for help texts. Surfaces may say it their own way. */
	description: string;
	/** Whether `raw` is one of this setting's values. */
	accepts(raw: unknown): raw is V;
	/** `raw` when it is one of the values, the default otherwise: a bad setting never blanks a view. */
	parse(raw: unknown): V;
}

/** A setting with a fixed list of values. */
export interface ChoiceSetting<V extends string = string>
	extends SettingBase<V> {
	type: "choice";
	values: readonly V[];
}

/** A setting that is on or off. */
export interface FlagSetting extends SettingBase<boolean> {
	type: "flag";
}

export type SettingDescriptor<V = unknown> = [V] extends [string]
	? ChoiceSetting<V>
	: [V] extends [boolean]
		? FlagSetting
		: never;

/** Any one setting, whatever its values. */
export type AnySetting = ChoiceSetting | FlagSetting;

function choice<V extends string>(
	key: string,
	kind: SettingKind,
	values: readonly V[],
	fallback: V,
	description: string,
): ChoiceSetting<V> {
	const accepts = (raw: unknown): raw is V =>
		(values as readonly unknown[]).includes(raw);
	return {
		type: "choice",
		key,
		kind,
		values,
		default: fallback,
		description,
		accepts,
		parse: (raw) => (accepts(raw) ? raw : fallback),
	};
}

function flag(
	key: string,
	kind: SettingKind,
	fallback: boolean,
	description: string,
): FlagSetting {
	const accepts = (raw: unknown): raw is boolean => typeof raw === "boolean";
	return {
		type: "flag",
		key,
		kind,
		default: fallback,
		description,
		accepts,
		parse: (raw) => (accepts(raw) ? raw : fallback),
	};
}

export const COMMENTS_MODES: readonly CommentsMode[] = ["show", "hide"];

export const NUTRITION_BASES: readonly NutritionBasis[] = [
	"auto",
	"total",
	"perPortion",
	"per100g",
];

/** Whether the quantities of the ingredients are repeated in the text of the steps. */
export type StepQuantitiesMode = "show" | "hide";

export const STEP_QUANTITIES_MODES: readonly StepQuantitiesMode[] = [
	"show",
	"hide",
];

/** What the views show of a recipe. */
export interface ViewSettings {
	miseEnPlace: MiseEnPlaceMode;
	rests: RestChoice;
	comments: CommentsMode;
	nutritionBasis: NutritionBasis;
	bakersMathOnly: boolean;
	stepQuantities: StepQuantitiesMode;
}

/** What the analyzer computes of a recipe. */
export interface RecipeSettings {
	bakersMath: boolean;
	massStandardization: boolean;
	yieldCalculation: boolean;
	nutritionEstimation: boolean;
}

type Descriptors<T> = { readonly [K in keyof T]: SettingDescriptor<T[K]> };

export const VIEW_SETTINGS: Descriptors<ViewSettings> = {
	miseEnPlace: choice(
		"miseEnPlace",
		"view",
		MISE_EN_PLACE_MODES,
		DEFAULT_MISE_EN_PLACE_MODE,
		"When the mise en place is planned: right before each section, all at the start, or at the start of each working day.",
	),
	rests: choice(
		"rests",
		"view",
		REST_CHOICES,
		DEFAULT_REST_CHOICE,
		"How long a rest written as a range lasts: the shortest, the middle or the longest of it.",
	),
	comments: choice(
		"comments",
		"view",
		COMMENTS_MODES,
		"show",
		"Whether the comments of the recipe are shown.",
	),
	nutritionBasis: choice(
		"nutritionBasis",
		"view",
		NUTRITION_BASES,
		"auto",
		"Which nutrition basis is shown: per portion when the recipe declares portions, otherwise the whole recipe; or always the whole recipe, per portion, per 100 g.",
	),
	bakersMathOnly: flag(
		"bakersMathOnly",
		"view",
		false,
		"Show only the baker's percentages, without the weights.",
	),
	stepQuantities: choice(
		"stepQuantities",
		"view",
		STEP_QUANTITIES_MODES,
		"show",
		"Whether the quantities of the ingredients are repeated in the text of the steps.",
	),
};

export const RECIPE_SETTINGS: Descriptors<RecipeSettings> = {
	bakersMath: flag(
		"bakersMath",
		"recipe",
		true,
		"Compute the baker's percentages, from the ingredient marked with * or the chosen reference.",
	),
	massStandardization: flag(
		"massStandardization",
		"recipe",
		true,
		"Convert the quantities to grams with the ingredient database.",
	),
	yieldCalculation: flag(
		"yieldCalculation",
		"recipe",
		true,
		"Account for the part of an ingredient lost when it is prepared (peel, stones), so the weight to buy differs from the weight used.",
	),
	nutritionEstimation: flag(
		"nutritionEstimation",
		"recipe",
		true,
		"Estimate the nutrition of the recipe from the ingredient database.",
	),
};

/** Every setting, view and recipe, for the surfaces that list them all. */
export const SETTINGS: readonly AnySetting[] = [
	...Object.values<AnySetting>(VIEW_SETTINGS),
	...Object.values<AnySetting>(RECIPE_SETTINGS),
];

function parseGroup<T>(descriptors: Descriptors<T>, raw: unknown): T {
	const source =
		raw !== null && typeof raw === "object"
			? (raw as Record<string, unknown>)
			: {};
	const out = {} as T;
	for (const key of Object.keys(descriptors) as (keyof T)[]) {
		const descriptor = descriptors[key] as unknown as SettingBase<T[keyof T]>;
		out[key] = descriptor.parse(source[descriptor.key]);
	}
	return out;
}

/**
 * The view settings found in `raw` (an editor configuration, a stored object,
 * anything): each one that is missing or unknown falls back on its default.
 */
export function parseViewSettings(raw: unknown): ViewSettings {
	return parseGroup(VIEW_SETTINGS, raw);
}

/** The recipe settings found in `raw`, each unknown one on its default. */
export function parseRecipeSettings(raw: unknown): RecipeSettings {
	return parseGroup(RECIPE_SETTINGS, raw);
}

export const DEFAULT_VIEW_SETTINGS: Readonly<ViewSettings> = Object.freeze(
	parseViewSettings(undefined),
);

export const DEFAULT_RECIPE_SETTINGS: Readonly<RecipeSettings> = Object.freeze(
	parseRecipeSettings(undefined),
);

/** The renderer options that carry `settings`. */
export function viewSettingsToRendererOptions(
	settings: ViewSettings,
): Pick<
	RendererOptions,
	| "miseEnPlace"
	| "rests"
	| "comments"
	| "nutritionBasis"
	| "bakersMathOnly"
	| "hideStepQty"
> {
	return {
		miseEnPlace: settings.miseEnPlace,
		rests: settings.rests,
		comments: settings.comments,
		nutritionBasis: settings.nutritionBasis,
		bakersMathOnly: settings.bakersMathOnly,
		hideStepQty: settings.stepQuantities === "hide",
	};
}

/** The analyzer options that carry `settings`. */
export function recipeSettingsToAnalyzerOptions(
	settings: RecipeSettings,
): Pick<
	AnalyzerOptions,
	| "enableBakersMath"
	| "enableMassStandardization"
	| "enableYieldCalculation"
	| "enableNutritionalEstimation"
> {
	return {
		enableBakersMath: settings.bakersMath,
		enableMassStandardization: settings.massStandardization,
		enableYieldCalculation: settings.yieldCalculation,
		enableNutritionalEstimation: settings.nutritionEstimation,
	};
}

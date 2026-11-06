import {
	type AnySetting,
	type RecipeSettings,
	RECIPE_SETTINGS,
	type ViewSettings,
	VIEW_SETTINGS,
	parseRecipeSettings,
	views,
} from "@gram-lang/renderer";
import type { ArgDef } from "citty";
import {
	flagDefault,
	flagValueList,
	parseChoiceFlag,
	toFlagValue,
} from "./setting-flags";

export type ViewSettingKey = keyof ViewSettings;
export type RecipeSettingKey = keyof RecipeSettings;

/**
 * The flag of a setting is named after it, in kebab-case (`nutritionBasis` →
 * `--nutrition-basis`); a name it had before is kept as an alias.
 */
export function settingFlagName(
	key: ViewSettingKey | RecipeSettingKey,
): string {
	return toFlagValue(key);
}

/** Help texts the CLI words its own way; the others come from the descriptor. */
const VIEW_DESCRIPTIONS: Partial<Record<ViewSettingKey, string>> = {
	miseEnPlace: `When the mise en place is planned: ${flagValueList(VIEW_SETTINGS.miseEnPlace)} (default: ${flagDefault(VIEW_SETTINGS.miseEnPlace)} — right before each section; upfront — all at the start; per-day — at the start of each working day). Changes the total and idle times.`,
	rests: `How long a rest written as a range (~_{12-24h}) lasts: ${flagValueList(VIEW_SETTINGS.rests)} (default: ${flagDefault(VIEW_SETTINGS.rests)}). An exact rest and an active timer are not affected. Changes the total and idle times.`,
	comments: `Whether to show the comments of the recipe (// like this): ${flagValueList(VIEW_SETTINGS.comments)} (default: ${flagDefault(VIEW_SETTINGS.comments)}).`,
	nutritionBasis: `Which nutrition basis to show: ${flagValueList(VIEW_SETTINGS.nutritionBasis)} (default: ${flagDefault(VIEW_SETTINGS.nutritionBasis)} — per portion when the recipe declares one, otherwise the whole recipe)`,
	bakersMathOnly: "Only show the percentages and hide absolute weights.",
	stepQuantities: `Whether ingredient quantities are repeated in step text: ${flagValueList(VIEW_SETTINGS.stepQuantities)} (default: ${flagDefault(VIEW_SETTINGS.stepQuantities)}). Quantities in a section's mise en place are always shown.`,
};

/**
 * A name a flag had before it was named after its setting, kept working. It is
 * declared as a flag of its own rather than a citty alias, which the help
 * would print with one dash, as a short option.
 */
const VIEW_ALIASES: Partial<Record<ViewSettingKey, string>> = {
	nutritionBasis: "nutrition",
};

const RECIPE_DESCRIPTIONS: Record<
	RecipeSettingKey,
	{ on: string; off: string }
> = {
	bakersMath: {
		on: "Display ingredient quantities as a percentage of a reference ingredient (Baker's Percentage), and warn when the recipe has none. Computed by default from an ingredient marked with *.",
		off: "Don't compute the baker's percentages.",
	},
	massStandardization: {
		on: "Convert the quantities to grams with the ingredient database (default: on).",
		off: "Keep the quantities as written, without converting them to grams.",
	},
	yieldCalculation: {
		on: "Account for the part of an ingredient lost when it is prepared (peel, stones), so the weight to buy differs from the weight used (default: on).",
		off: "Ignore what is lost when an ingredient is prepared.",
	},
	nutritionEstimation: {
		on: "Estimate the nutrition of the recipe from the ingredient database (default: on).",
		off: "Don't estimate the nutrition.",
	},
};

function viewArg(key: ViewSettingKey): ArgDef {
	const setting: AnySetting = VIEW_SETTINGS[key];
	const description = VIEW_DESCRIPTIONS[key] ?? setting.description;
	return setting.type === "flag"
		? { type: "boolean", description }
		: { type: "string", description };
}

/** The citty argument definitions of the view settings a command exposes. */
export function viewSettingArgs(
	keys: readonly ViewSettingKey[],
): Record<string, ArgDef> {
	return Object.fromEntries(
		keys.flatMap((key) => {
			const flag = settingFlagName(key);
			const alias = VIEW_ALIASES[key];
			const entries: [string, ArgDef][] = [[flag, viewArg(key)]];
			if (alias) {
				entries.push([
					alias,
					{ type: "string", description: `Same as --${flag}` },
				]);
			}
			return entries;
		}),
	);
}

/**
 * The citty argument definitions of the recipe settings, all on by default:
 * `--no-<flag>` turns one off.
 */
export function recipeSettingArgs(): Record<string, ArgDef> {
	return Object.fromEntries(
		(Object.keys(RECIPE_SETTINGS) as RecipeSettingKey[]).map((key) => [
			settingFlagName(key),
			{
				type: "boolean",
				description: RECIPE_DESCRIPTIONS[key].on,
				negativeDescription: RECIPE_DESCRIPTIONS[key].off,
			} satisfies ArgDef,
		]),
	);
}

type ParsedArgs = Record<string, unknown>;

/**
 * The view settings given on the command line, each left out when its flag
 * is absent so the command's own default applies. An unknown value is
 * reported and ends the command.
 */
export function readViewSettingArgs(
	args: ParsedArgs,
	keys: readonly ViewSettingKey[],
): Partial<ViewSettings> {
	const out: Partial<Record<ViewSettingKey, unknown>> = {};
	for (const key of keys) {
		const setting: AnySetting = VIEW_SETTINGS[key];
		const alias = VIEW_ALIASES[key];
		// The flag the user wrote: the setting's own name, or the name it had.
		const flag =
			args[settingFlagName(key)] === undefined &&
			alias &&
			args[alias] !== undefined
				? alias
				: settingFlagName(key);
		const raw = args[flag];
		const value =
			setting.type === "flag"
				? typeof raw === "boolean"
					? raw
					: undefined
				: parseChoiceFlag(setting, flag, raw);
		if (value !== undefined) out[key] = value;
	}
	// `--no-step-qty`, the name `--step-quantities hide` had first.
	if (
		keys.includes("stepQuantities") &&
		out.stepQuantities === undefined &&
		args["step-qty"] === false
	) {
		out.stepQuantities = "hide";
	}
	return out as Partial<ViewSettings>;
}

/** The recipe settings of the command line: on unless `--no-<flag>`. */
export function readRecipeSettingArgs(args: ParsedArgs): RecipeSettings {
	return parseRecipeSettings(
		Object.fromEntries(
			(Object.keys(RECIPE_SETTINGS) as RecipeSettingKey[]).map((key) => [
				key,
				args[settingFlagName(key)],
			]),
		),
	);
}

/**
 * The flag `--step-qty` had before `--step-quantities`, kept so
 * `--no-step-qty` keeps working.
 */
export const STEP_QTY_ALIAS_ARG: Record<string, ArgDef> = {
	"step-qty": {
		type: "boolean",
		description:
			"Same as --step-quantities: --no-step-qty is --step-quantities hide",
	},
};

/**
 * Every view setting a view of the registry honors: what `print` and `export`
 * expose, since their `--view` picks any view. Read from the registry, so the
 * setting a new view brings gets its flag here with no edit.
 */
export const EXPORT_VIEW_SETTINGS: readonly ViewSettingKey[] = (
	Object.keys(VIEW_SETTINGS) as ViewSettingKey[]
).filter((key) =>
	views.some((view) => (view.honors as readonly string[]).includes(key)),
);

/** What the run sheet honors: `gram plan`. Read from its view, not copied. */
export const RUN_SHEET_SETTINGS: readonly ViewSettingKey[] = (
	Object.keys(VIEW_SETTINGS) as ViewSettingKey[]
).filter((key) =>
	views.find((view) => view.id === "runSheet")?.honors.includes(key as never),
);

/** The two settings of a timeline alone: `gram cook`'s total time and timers. */
export const TIMELINE_SETTINGS: readonly ViewSettingKey[] = [
	"miseEnPlace",
	"rests",
];

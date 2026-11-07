import type { GramLocale } from "@gram-lang/i18n";
import {
	defaultOptions,
	isOptionModified,
	type OPTION_SETTING_KEYS,
	type PlaygroundOptions,
} from "./settingsStorage";

// What each section of settings says of itself, from the options it owns: whether
// it differs from the defaults (its dot), what it changed (the dot's tooltip) and
// what resetting it sets back. No rendering, so each is testable on its own.

const DISPLAY_KEYS = [
	"comments",
	"stepQuantities",
] as const satisfies readonly (typeof OPTION_SETTING_KEYS)[number][];

/** Baker's math: on, only the percentages, or a chosen reference. */
export function isBakersModified(options: PlaygroundOptions): boolean {
	return (
		isOptionModified(options, "bakersMath") ||
		isOptionModified(options, "bakersMathOnly") ||
		Boolean(options.bakersReference)
	);
}

export function bakersBadgeTitle(
	options: PlaygroundOptions,
	t: GramLocale,
): string {
	const title = t.playground.sections.bakersMath;
	if (options.bakersReference) return `${title}: ${options.bakersReference}`;
	return title;
}

export function resetBakers(options: PlaygroundOptions): PlaygroundOptions {
	const defaults = defaultOptions();
	return {
		...options,
		bakersMath: defaults.bakersMath,
		bakersMathOnly: defaults.bakersMathOnly,
		bakersReference: undefined,
	};
}

/** Display: the comments and the quantities in the steps. */
export function isDisplayModified(options: PlaygroundOptions): boolean {
	return DISPLAY_KEYS.some((key) => isOptionModified(options, key));
}

export function resetDisplay(options: PlaygroundOptions): PlaygroundOptions {
	const defaults = defaultOptions();
	return {
		...options,
		comments: defaults.comments,
		stepQuantities: defaults.stepQuantities,
	};
}

/** Physical analysis and nutrition: the analyses that are on, and the nutrition basis. */
export function isPhysicsModified(options: PlaygroundOptions): boolean {
	return (
		isOptionModified(options, "massStandardization") ||
		isOptionModified(options, "yieldCalculation") ||
		isOptionModified(options, "nutritionEstimation") ||
		isOptionModified(options, "nutritionBasis")
	);
}

export function physicsBadgeTitle(
	options: PlaygroundOptions,
	t: GramLocale,
): string {
	const parts: string[] = [];
	if (options.massStandardization) {
		parts.push(t.playground.options.massStandardization);
	}
	if (options.yieldCalculation)
		parts.push(t.playground.options.yieldManagement);
	if (options.nutritionEstimation) parts.push(t.playground.options.nutrition);
	return parts.length > 0 ? parts.join(" · ") : t.playground.badges.inactive;
}

export function resetPhysics(options: PlaygroundOptions): PlaygroundOptions {
	const defaults = defaultOptions();
	return {
		...options,
		massStandardization: defaults.massStandardization,
		yieldCalculation: defaults.yieldCalculation,
		nutritionEstimation: defaults.nutritionEstimation,
		nutritionBasis: defaults.nutritionBasis,
	};
}

/** Stock: the modules the cook already has on hand. */
export function isStockModified(stocked: Set<string> | undefined): boolean {
	return (stocked?.size ?? 0) > 0;
}

export function stockBadgeTitle(
	stocked: Set<string> | undefined,
	t: GramLocale,
): string {
	return t.playground.badges.inStock.replace(
		"{count}",
		String(stocked?.size ?? 0),
	);
}

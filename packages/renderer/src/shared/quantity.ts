import {
	isRefusedSum,
	type QuantityPart,
	termsOfParts,
	termsOfUsage,
} from "@gram-lang/kitchen";
import { formatTerms, localizeDecimals, type Term } from "@gram-lang/i18n";
import type { RenderContext } from "../types";
import {
	formatDecimalToFraction,
	getQty,
	joinAmounts,
	type NumberStyle,
} from "./utils";

/** What `formatUsageQuantity` needs to know of the view that shows an amount. */
export interface QuantityContext extends NumberStyle {
	/** The recipe is scaled (`scaleFactor` ≠ 1): every amount is worked out. */
	scaled?: boolean;
	/** A shopping list: amounts are what the reader buys. */
	buying?: boolean;
}

/** The `QuantityContext` of a render context. */
export function quantityContext(context: RenderContext): QuantityContext {
	return {
		lang: context.lang,
		formatFraction: context.formatFraction,
		scaled: isScaled(context.scaleFactor),
		buying: context.formatMode === "shopping-list",
	};
}

/** True for a scale factor that changed the amounts. */
export function isScaled(scaleFactor: number | undefined): boolean {
	return typeof scaleFactor === "number" && scaleFactor !== 1;
}

/**
 * The mentions of a section entry (`aggToRendererItem`): the amount of each,
 * as its step wrote it.
 */
export interface SectionMentions {
	mentions?: Record<string, unknown>[];
}

/**
 * The terms of a section entry (`aggToRendererItem`): the quantities of every
 * occurrence, already added up unit by unit. Set apart from `parts`, which
 * only ever holds what one occurrence wrote.
 */
export interface SummedTerms {
	terms?: Term[];
}

/**
 * The one way a view writes the amount of an ingredient, a reference or a
 * shopping entry, from its terms (`parts`, or `qty` / `unit`):
 *
 * - as the author wrote it (`1 cup + 1 tbsp`, `1/2 cup − 2 tbsp`), when Gram
 *   changed nothing;
 * - worked out (`formatTerms` in `"computed"` mode) when the recipe is scaled,
 *   when a section adds up several occurrences, and in a shopping list:
 *   `2 cup + 2 tbsp`, never `34 tbsp`; `2.4 kg` in a step, `1.5 kg` to buy.
 *
 * A sum Gram refused is always written as it is (it counts for nothing).
 * An amount with no terms (a text, a relative quantity) keeps its text. The
 * quantities a shopping entry could not add up (`variable_entries`) follow,
 * joined by ` + `. Empty when there is no amount.
 */
export function formatUsageQuantity(
	item: Record<string, unknown>,
	ctx: QuantityContext = {},
): string {
	// A section entry: each mention written on its own, joined by ` + `
	// (`100 g + 100 g`, two portions to weigh), never added up.
	const mentions = (item as SectionMentions).mentions;
	if (Array.isArray(mentions)) {
		return joinAmounts(
			mentions.map((m) =>
				formatUsageQuantity(m as Record<string, unknown>, ctx),
			),
		);
	}
	const parts = item.parts as QuantityPart[] | undefined;
	const summed = (item as SummedTerms).terms;
	let terms: Term[];
	let refused = false;
	if (Array.isArray(summed)) {
		terms = summed;
	} else if (parts?.length) {
		refused = isRefusedSum(item);
		terms = termsOfParts(parts);
	} else {
		terms = termsOfUsage(item);
	}

	const extra = Array.isArray(item.variable_entries)
		? item.variable_entries.filter((e): e is string => typeof e === "string")
		: [];

	let text = "";
	if (terms.length > 0) {
		const computed =
			!refused &&
			(ctx.scaled ||
				ctx.buying ||
				(Array.isArray(summed) && summed.length > 1));
		text = formatTerms(terms, {
			mode: computed ? "computed" : "written",
			lang: ctx.lang,
			buying: ctx.buying,
			// Only a scaled amount, no exact measure anyway, may be rounded.
			rounding: !!ctx.scaled,
			number: (value, unit) =>
				formatDecimalToFraction(value, unit ?? undefined, ctx),
			text: (written) => localizeDecimals(written, ctx.lang),
		});
	} else if (!Array.isArray(summed)) {
		// A text (`{une pincée}`) or a relative quantity (`{10%}`).
		const qty = getQty(item, ctx);
		const unit = typeof item.unit === "string" ? item.unit : "";
		if (qty) {
			const value = qty.text || formatDecimalToFraction(qty.value, unit, ctx);
			text = unit ? `${value} ${unit}` : value;
		} else if (unit && !parts?.length) {
			// A quantity in words (`{une pincée}`): no number, the whole text
			// is its unit. Written as is, never scaled.
			text = unit;
		}
	}
	return joinAmounts([text, ...extra]);
}

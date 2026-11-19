/**
 * The bridge between the compiled recipe (and the AST) and the quantity model
 * of `@gram-lang/i18n`: every reading of an ingredient's amount goes through
 * `termsOfUsage` / `termsOfAst`, every writing through `usageFromTerms`, so
 * the shape a quantity is stored in is known in one place only.
 */
import {
	ASTNodeType,
	type CompoundQuantityAST,
	type QuantityAST,
	type RelativeQuantityAST,
	type TextQuantityAST,
} from "@gram-lang/parser";
import {
	familyOf,
	formatTerms,
	groupTerms,
	isTermValue,
	QuantityOverflowError,
	scaleTerms,
	type Term,
	round2,
	type TermValue,
	type TermsTotal,
	termsTotal,
	termValueNumber,
} from "@gram-lang/i18n";
// Imported from "./scale/types" (not the "./scale" barrel) to avoid a cycle.
import { InvalidFactorError } from "./scale/types";
import type { Usage } from "./types";

/** Re-exported for kitchen's callers (the analyzer, the language server). */
export { familyOf };

/**
 * One term of a sum as the compiled recipe stores it (`Usage.parts`): its
 * number (a plain number, or a fraction / range object), its unit, and
 * `minus: true` when it is taken away. Since 1.5.0.
 */
export interface QuantityPart {
	qty: TermValue;
	unit: string | null;
	minus?: true;
}

/** A record that carries an amount the way the compiled recipe does. */
export interface QuantityHolder {
	qty?: Usage["qty"] | null;
	unit?: string | null;
	parts?: QuantityPart[];
	/** A shopping entry's bounds, next to its middle in `qty` (`shoppingAmount`). */
	range?: { min: number; max: number };
}

/** The terms of `parts`, in their written order, whatever they amount to. */
export function termsOfParts(
	parts: readonly QuantityPart[] | null | undefined,
): Term[] {
	return (parts ?? []).flatMap((part) =>
		isTermValue(part.qty)
			? [
					part.minus
						? { value: part.qty, unit: part.unit ?? null, minus: true }
						: { value: part.qty, unit: part.unit ?? null },
				]
			: [],
	);
}

/** A term as `parts` stores it: a single value as a plain number, like `qty`. */
function partOfTerm(term: Term): QuantityPart {
	const v = term.value;
	const qty = typeof v === "object" && v.type === "single" ? v.value : v;
	return term.minus
		? { qty, unit: term.unit, minus: true }
		: { qty, unit: term.unit };
}

/**
 * True for a sum Gram refused (an `INVALID_QUANTITY` warning): its `parts`
 * are kept for display, with no total, so it counts for nothing.
 */
export function isRefusedSum(holder: QuantityHolder): boolean {
	return (
		!!holder.parts?.length &&
		(holder.qty === undefined || holder.qty === null) &&
		!holder.unit
	);
}

/**
 * The terms of a `qty` / `unit` pair: one term for a number, a single, a
 * fraction or a range; none for a text (`{une pincée}`), a relative quantity
 * (`{10%}`) or no quantity at all.
 */
export function termsOfQuantity(
	qty: Usage["qty"] | null | undefined,
	unit: string | null | undefined,
): Term[] {
	if (!isTermValue(qty)) return [];
	return [{ value: qty, unit: unit ?? null }];
}

/** The terms of a compiled usage (an ingredient, a reference, a shopping entry). */
export function termsOfUsage(usage: QuantityHolder | null | undefined): Term[] {
	if (!usage) return [];
	// `parts` first: the text a sum of several families keeps in `unit`
	// (`1 cup + 20 g`) is never a unit.
	if (usage.parts?.length) {
		return isRefusedSum(usage) ? [] : termsOfParts(usage.parts);
	}
	// A shopping entry keeps a range as its middle plus its bounds.
	if (typeof usage.qty === "number" && usage.range) {
		const { min, max } = usage.range;
		return termsOfQuantity(
			{ type: "range", value: usage.qty, range: { min, max } },
			usage.unit,
		);
	}
	return termsOfQuantity(usage.qty, usage.unit);
}

/**
 * A total as a shopping entry stores it: `qty` always a number (the middle
 * of a range, rounded to 2 decimals), and for a range its bounds in `range`.
 * No total gives `qty` 0 in `fallbackUnit`.
 */
export function shoppingAmount(
	total: TermsTotal | null,
	fallbackUnit: string | null = null,
): { qty: number; unit: string | null; range?: { min: number; max: number } } {
	if (!total) return { qty: 0, unit: fallbackUnit };
	const { qty, unit } = total;
	const middle = round2(termValueNumber(qty) ?? 0);
	if (typeof qty === "object" && qty.type === "range" && qty.range) {
		return {
			qty: middle,
			unit,
			range: { min: round2(qty.range.min), max: round2(qty.range.max) },
		};
	}
	return { qty: middle, unit };
}

/** The terms of a composite parent's share (`<@eggs{…}`), read like a usage. */
export function termsOfComposite(
	composite:
		| {
				quantity?: Usage["qty"] | null;
				unit?: string | null;
				parts?: QuantityPart[];
		  }
		| null
		| undefined,
): Term[] {
	if (!composite) return [];
	return termsOfUsage({
		qty: composite.quantity,
		unit: composite.unit,
		parts: composite.parts,
	});
}

/** Where an amount goes: a usage's `qty`, or a composite parent's `quantity`. */
type AmountField = "qty" | "quantity";

/**
 * Writes a sum into `holder`: its `parts`, always, then what they amount to.
 *
 * - one family (`1 cup + 1 tbsp`): the total in `qty` / `unit` (`17 tbsp`);
 * - several families (`1 cup + 20 g`): no number, the sum as text in `unit`,
 *   the way a text quantity (`{une pincée}`) is kept;
 * - `refused` (an `INVALID_QUANTITY`): `parts` only, no total.
 */
export function writeSum<T extends object>(
	holder: T,
	terms: readonly Term[],
	refused = false,
	field: AmountField = "qty",
): T {
	const target = holder as Record<string, unknown>;
	const total = refused ? null : termsTotal(terms);
	if (total) {
		const qty = total.qty;
		target[field] =
			typeof qty === "object" && qty.type === "single" ? qty.value : qty;
		target.unit = total.unit;
	} else {
		delete target[field];
		if (refused) delete target.unit;
		// Normalized: written from the parts, a decimal with its point.
		else
			target.unit = formatTerms(termsOfParts(terms.map(partOfTerm)), {
				minus: " - ",
			});
	}
	target.parts = terms.map(partOfTerm);
	return holder;
}

/**
 * The terms of a quantity node of the AST, read like `termsOfUsage` reads a
 * usage: one per term of a sum (`{1 cup - 2 tbsp}`), in the order written.
 * The values keep their AST shape (`{ type: "single", … }`), so terms scaled
 * here can be written back into the node.
 */
export function termsOfAst(
	node:
		| QuantityAST
		| CompoundQuantityAST
		| RelativeQuantityAST
		| TextQuantityAST
		| null
		| undefined,
): Term[] {
	if (!node) return [];
	if (node.type === ASTNodeType.CompoundQuantity) {
		// A term with no value (`1/0`) is left out, as a quantity with none is.
		return node.terms.flatMap((term) =>
			isTermValue(term.value)
				? [
						term.minus
							? { value: term.value, unit: term.unit, minus: true }
							: { value: term.value, unit: term.unit },
					]
				: [],
		);
	}
	if (node.type !== ASTNodeType.Quantity) return [];
	return termsOfQuantity(node.value, node.unit);
}

/**
 * Writes what `terms` amount to into `usage` (`qty`, and `unit` when it
 * changes). Terms with no single total leave the usage as it is.
 */
export function usageFromTerms<T extends QuantityHolder>(
	usage: T,
	terms: readonly Term[],
): T {
	const total = termsTotal(terms);
	if (!total) return usage;
	usage.qty = total.qty;
	if (total.unit !== (usage.unit ?? null)) usage.unit = total.unit;
	return usage;
}

/** The number the terms amount to (the middle of a range), or `null`. */
export function numericTotal(terms: readonly Term[]): number | null {
	const total = termsTotal(terms);
	return total ? termValueNumber(total.qty) : null;
}

/**
 * The terms grouped by family (`familyOf`), groups in the order their first
 * term is written. Each group adds up to one amount (`termsTotal`): a sum of
 * several families counts as one occurrence per family, as if they had been
 * written apart.
 */
export function termsByFamily(terms: readonly Term[]): Term[][] {
	return groupTerms(terms, "family");
}

/**
 * What the terms amount to, one number and unit per family
 * (`termsByFamily`): `{1 kg + 200 g}` is 1200 g, `{1 cup + 20 g}` is 1 cup
 * and 20 g. A range counts by its middle.
 */
export function familyTotals(
	terms: readonly Term[],
): { value: number; unit: string | null }[] {
	return termsByFamily(terms).flatMap((group) => {
		const total = termsTotal(group);
		const value = total ? termValueNumber(total.qty) : null;
		return total && value !== null ? [{ value, unit: total.unit }] : [];
	});
}

/** `scaleTerms`, an overflow reported as the scaler's own `InvalidFactorError`. */
export function scaleTermsChecked(
	terms: readonly Term[],
	factor: number,
): Term[] {
	try {
		return scaleTerms(terms, factor);
	} catch (error) {
		if (error instanceof QuantityOverflowError) {
			throw new InvalidFactorError(factor, error.message);
		}
		throw error;
	}
}

/**
 * The terms scaled by `factor`, and what they amount to: one helper for the
 * compiled recipe (`applyScale`) and the AST (`scaleAst`), so both scale
 * alike. `null` when there is nothing to scale. An overflow is reported as
 * the scaler's own `InvalidFactorError`.
 */
export function scaleUsageTerms(
	terms: readonly Term[],
	factor: number,
): TermsTotal | null {
	if (terms.length === 0) return null;
	return termsTotal(scaleTermsChecked(terms, factor));
}

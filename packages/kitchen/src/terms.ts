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
	formatTerms,
	isTermValue,
	normalizeUnit,
	QuantityOverflowError,
	scaleTerms,
	type Term,
	type TermValue,
	type TermsTotal,
	termsTotal,
	termValueNumber,
	UNIT_CONVERSIONS,
} from "@gram-lang/i18n";
// Imported from "./scale/types" (not the "./scale" barrel) to avoid a cycle.
import { InvalidFactorError } from "./scale/types";
import type { Usage } from "./types";

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
	return termsOfQuantity(usage.qty, usage.unit);
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
 * The kind of amount a unit measures, for telling the families of a sum
 * apart: a mass, a volume, or (a unit Gram cannot convert, `gousse`) that
 * unit itself.
 */
export function familyOf(unit: string | null): string {
	const key = normalizeUnit(unit);
	if (UNIT_CONVERSIONS.mass.map[key] !== undefined) return "mass";
	if (UNIT_CONVERSIONS.volume.map[key] !== undefined) return "volume";
	return `unit:${key}`;
}

/**
 * The terms grouped by family (`familyOf`), groups in the order their first
 * term is written. Each group adds up to one amount (`termsTotal`): a sum of
 * several families counts as one occurrence per family, as if they had been
 * written apart.
 */
export function termsByFamily(terms: readonly Term[]): Term[][] {
	const groups = new Map<string, Term[]>();
	for (const term of terms) {
		const key = familyOf(term.unit);
		const group = groups.get(key);
		if (group) group.push(term);
		else groups.set(key, [term]);
	}
	return [...groups.values()];
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

/**
 * The amounts a usage stands for, each a unit and the terms that add up in
 * it: one for a plain quantity or a sum of one family, one per family for a
 * sum of several (`1 cup + 20 g`), none when it has no terms.
 */
export function amountsOfUsage(
	usage: QuantityHolder,
): { unit: string | null; terms: Term[] }[] {
	const terms = termsOfUsage(usage);
	if (terms.length === 0) return [];
	if (!usage.parts?.length || termsTotal(terms)) {
		return [{ unit: usage.unit ?? null, terms }];
	}
	return termsByFamily(terms).map((group) => ({
		unit: termsTotal(group)?.unit ?? group[0]?.unit ?? null,
		terms: group,
	}));
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

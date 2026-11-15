/**
 * The bridge between the compiled recipe (and the AST) and the quantity model
 * of `@gram-lang/i18n`: every reading of an ingredient's amount goes through
 * `termsOfUsage` / `termsOfAst`, every writing through `usageFromTerms`, so
 * the shape a quantity is stored in is known in one place only.
 */
import {
	ASTNodeType,
	type QuantityAST,
	type RelativeQuantityAST,
	type TextQuantityAST,
} from "@gram-lang/parser";
import {
	isTermValue,
	QuantityOverflowError,
	scaleTerms,
	type Term,
	type TermsTotal,
	termsTotal,
	termValueNumber,
} from "@gram-lang/i18n";
// Imported from "./scale/types" (not the "./scale" barrel) to avoid a cycle.
import { InvalidFactorError } from "./scale/types";
import type { Usage } from "./types";

/** A record that carries an amount the way the compiled recipe does. */
export interface QuantityHolder {
	qty?: Usage["qty"] | null;
	unit?: string | null;
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
	return termsOfQuantity(usage.qty, usage.unit);
}

/**
 * The terms of a quantity node of the AST, read like `termsOfUsage` reads a
 * usage. The values keep their AST shape (`{ type: "single", … }`), so terms
 * scaled here can be written back into the node.
 */
export function termsOfAst(
	node: QuantityAST | RelativeQuantityAST | TextQuantityAST | null | undefined,
): Term[] {
	if (!node || node.type !== ASTNodeType.Quantity) return [];
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
	try {
		return termsTotal(scaleTerms(terms, factor));
	} catch (error) {
		if (error instanceof QuantityOverflowError) {
			throw new InvalidFactorError(factor, error.message);
		}
		throw error;
	}
}

/**
 * Reading a sum of quantities (`{1 cup + 1 tbsp}`, `{1 cup - 2 tbsp}`): its
 * terms, and what is wrong with it. Pure: the processor turns the problems
 * into warnings, `createCleanUsage` and `processReference` write the terms
 * (`writeSum`), so the warnings and the compiled quantity always agree.
 */
import type { CompoundQuantityAST, Location } from "@gram-lang/parser";
import {
	isMeasureUnit,
	normalizeUnit,
	round2,
	type Term,
	termsTotal,
	termValueNumber,
	unitContainsQuantity,
} from "@gram-lang/i18n";
import { familyOf, termsByFamily, termsOfAst } from "./terms";

/** Why a sum is refused (`INVALID_QUANTITY`). */
export type InvalidQuantityReason =
	/** `{100 g + 10%}`: a percentage is not an amount. */
	| "percentTerm"
	/** `{2 x 100 g + 50 g}`: a multiplication is not a term. */
	| "expressionTerm"
	/** `{1 + 1 cup}`: every term needs its unit. */
	| "unitlessTerm"
	/** `{1 boîte de 400 g + 50 g}`: a unit holding a quantity of its own. */
	| "quantityInUnit"
	/** `{1 tbsp - 1 cup}`: the sum comes to nothing, or less. */
	| "nonPositiveTotal"
	/** `{1 cup - 1-2 tbsp}`: a range after `-` swaps its bounds. */
	| "rangeAfterMinus"
	/** `{1 cup - 20 g}`: taken away from another family, nothing to check it against. */
	| "minusAcrossFamilies";

export interface SumProblem {
	reason: InvalidQuantityReason;
	/** The term at fault, as written (the whole sum for a total). */
	value: string;
	/** What to write instead, when Gram can tell (`110 g`). */
	suggestion?: string;
	loc?: Location;
}

export interface SumReading {
	/** The terms, in their written order (a term with no number is left out). */
	terms: Term[];
	/** Each makes the sum refused: its terms are kept, it counts for nothing. */
	problems: SumProblem[];
	/** Terms whose unit reads as two quantities (`1 lb 4 oz`), kept as they are. */
	twoQuantities: { value: string; loc?: Location }[];
	/** An `oz` term next to a volume (`1 cup + 2 oz`): `oz` is a weight. */
	ozAfterVolume?: { value: string; loc?: Location };
}

/** `x 100 g`, `× 2`, `* 3`: the unit of a term that multiplies. */
const MULTIPLICATION = /^[x×*](?:\s|\d|$)/i;

/**
 * `{1 cup 5 tbsp}`: a unit made of a known unit, a number and another known
 * unit reads as two quantities, which Gram does not add. Unflagged, the whole
 * "cup 5 tbsp" passed as one unknown unit: no mass, and a scaled recipe read
 * "2 cup 5 tbsp". `{1 boîte de 400 g}` is not one: "boîte de" is no unit, and
 * its 400 g describes the tin, so scaling the number of tins stays right.
 */
export function looksLikeTwoQuantities(unit: string): boolean {
	return splitTwoQuantities(unit) !== null;
}

/**
 * The two quantities a unit reads as (`looksLikeTwoQuantities`): `cup 5 tbsp`
 * is `["cup", "5 tbsp"]`, what to write as `cup + 5 tbsp`. `null` when the
 * unit is not two quantities.
 */
export function splitTwoQuantities(unit: string): [string, string] | null {
	const words = unit.trim().split(/\s+/);
	for (let i = 1; i < words.length; i++) {
		const number = words[i]?.match(/^\d+(?:[.,/]\d+)?(.*)$/);
		if (!number) continue;
		const first = words.slice(0, i).join(" ");
		const second = [number[1], ...words.slice(i + 1)].join(" ").trim();
		if (second && isMeasureUnit(first) && isMeasureUnit(second)) {
			return [first, words.slice(i).join(" ")];
		}
	}
	return null;
}

/** Reads a sum: its terms and what is wrong with it (see `SumReading`). */
export function readSum(
	node: CompoundQuantityAST,
	itemLoc: Location | undefined,
): SumReading {
	const terms = termsOfAst(node);
	const problems: SumProblem[] = [];
	const twoQuantities: SumReading["twoQuantities"] = [];
	const uri = itemLoc?.uri;
	const locOf = (loc: Location | undefined): Location | undefined =>
		loc && uri && !loc.uri ? { ...loc, uri } : loc;
	const raw = node.raw;
	const textOf = (loc: Location | undefined): string =>
		loc && node.loc
			? raw.slice(loc.start - node.loc.start, loc.end - node.loc.start).trim()
			: raw;

	let percent = 0;
	for (const term of node.terms) {
		const loc = locOf(term.loc);
		const value = textOf(term.loc);
		const unit = term.unit?.trim() || null;
		if (!unit) {
			problems.push({ reason: "unitlessTerm", value, loc });
		} else if (unit === "%") {
			const n = term.value ? termValueNumber(term.value) : null;
			if (n !== null) percent += term.minus ? -n : n;
			problems.push({ reason: "percentTerm", value, loc });
		} else if (MULTIPLICATION.test(unit)) {
			problems.push({ reason: "expressionTerm", value, loc });
		} else if (looksLikeTwoQuantities(unit)) {
			twoQuantities.push({ value: unit, loc });
		} else if (unitContainsQuantity(unit)) {
			problems.push({ reason: "quantityInUnit", value, loc });
		}
		if (term.minus && term.value?.type === "range") {
			problems.push({ reason: "rangeAfterMinus", value, loc });
		}
	}

	// `{100 g + 10%}` meant 110 g: say so, when the rest adds up.
	const percentProblems = problems.filter((p) => p.reason === "percentTerm");
	if (
		percentProblems.length > 0 &&
		problems.length === percentProblems.length
	) {
		const rest = terms.filter((t) => normalizeUnit(t.unit) !== "%");
		const total = termsTotal(rest);
		const isRange =
			typeof total?.qty === "object" && total.qty.type === "range";
		const n = total && !isRange ? termValueNumber(total.qty) : null;
		if (n !== null && total?.unit) {
			const suggestion = `${round2(n * (1 + percent / 100))} ${total.unit}`;
			for (const p of percentProblems) p.suggestion = suggestion;
		}
	}

	if (problems.length === 0) {
		const total = familyProblem(terms, raw, locOf(node.loc));
		if (total) problems.push(total);
	}

	return {
		terms,
		problems,
		twoQuantities,
		ozAfterVolume: ozAfterVolume(node, locOf, textOf),
	};
}

/**
 * Each family checks its own subtraction: a term taken away needs terms of
 * its family to be taken from (`minusAcrossFamilies`), and what they come
 * to must stay above zero (`nonPositiveTotal`).
 */
function familyProblem(
	terms: Term[],
	raw: string,
	loc: Location | undefined,
): SumProblem | null {
	if (!terms.some((t) => t.minus)) return null;
	for (const group of termsByFamily(terms)) {
		if (!group.some((t) => t.minus)) continue;
		if (!group.some((t) => !t.minus)) {
			return { reason: "minusAcrossFamilies", value: raw, loc };
		}
		const total = termsTotal(group);
		const qty = total?.qty;
		const lowest =
			qty === undefined
				? null
				: typeof qty === "object" && qty.type === "range"
					? qty.range.min
					: termValueNumber(qty);
		if (lowest !== null && lowest <= 0) {
			return { reason: "nonPositiveTotal", value: raw, loc };
		}
	}
	return null;
}

/** The first `oz` term written after a volume (`1 cup + 2 oz`), if any. */
function ozAfterVolume(
	node: CompoundQuantityAST,
	locOf: (loc: Location | undefined) => Location | undefined,
	textOf: (loc: Location | undefined) => string,
): SumReading["ozAfterVolume"] {
	let sawVolume = false;
	for (const term of node.terms) {
		const key = normalizeUnit(term.unit);
		if (sawVolume && key === "oz") {
			return { value: textOf(term.loc), loc: locOf(term.loc) };
		}
		if (familyOf(term.unit) === "volume") sawVolume = true;
	}
	return undefined;
}

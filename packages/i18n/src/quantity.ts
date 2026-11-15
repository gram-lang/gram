/**
 * The one model every amount of an ingredient goes through: a list of terms,
 * each a value and a unit, added or taken away (`1 cup + 1 tbsp`,
 * `1 cup - 2 tbsp`). A plain `{200 g}` is one term.
 *
 * Pure and neutral: it knows nothing of the parser's AST or of the compiled
 * recipe. `@gram-lang/kitchen` reads its usages and AST nodes into terms
 * (`termsOfUsage`, `termsOfAst`) and writes them back (`usageFromTerms`).
 */
import { normalizeUnit } from "./units";

/**
 * A numeric value as the compiled recipe stores it: a plain number, or the
 * parser's single / fraction / range shape (structurally the parser's
 * `QuantityValueAST`, redeclared here so this module stays free of it).
 */
export type QuantityValue =
	| { type: "single"; value: number; text?: string }
	| {
			type: "fraction";
			value: number;
			numerator: number;
			denominator: number;
			text?: string;
	  }
	| {
			type: "range";
			value: number;
			range: { min: number; max: number };
			text?: string;
	  };

/** The value of one term: kept in the shape it was written in. */
export type TermValue = number | QuantityValue;

export interface Term {
	value: TermValue;
	unit: string | null;
	/** Taken away from the total (`- 2 tbsp`). */
	minus?: boolean;
}

/** What a list of terms amounts to, in the compiled recipe's `qty` / `unit` shape. */
export interface TermsTotal {
	qty: TermValue;
	unit: string | null;
}

/** Raised by `scaleTerms` when a scaled value stops being a finite number. */
export class QuantityOverflowError extends RangeError {
	constructor(public readonly factor: number) {
		super(
			`Scaling by a factor of ${factor} overflowed a quantity to a non-finite value.`,
		);
		this.name = "QuantityOverflowError";
	}
}

/**
 * Rounds a mass/quantity value to 2 decimal places, returning a `number`
 * (not a string). Centralizes the `parseFloat(x.toFixed(2))` idiom used
 * throughout kitchen/analyzer so there is a single, documented rounding rule
 * to port when the compiler is reimplemented in another language: `toFixed`
 * uses round-half-away-from-zero on the value's shortest decimal
 * representation, which differs from IEEE round-half-to-even on exact ties.
 */
export const round2 = (value: number): number => parseFloat(value.toFixed(2));

/** True for a value a term can hold (a number, or a single / fraction / range). */
export function isTermValue(value: unknown): value is TermValue {
	if (typeof value === "number") return true;
	if (!value || typeof value !== "object") return false;
	const type = (value as { type?: unknown }).type;
	return type === "single" || type === "fraction" || type === "range";
}

/**
 * The number a value stands for: the number itself, or its `value` (the
 * middle of a range). `null` when the value carries no number.
 */
export function termValueNumber(value: TermValue): number | null {
	if (typeof value === "number") return value;
	return value.value ?? null;
}

/** Terms added first, then terms taken away, each group in its written order. */
function addedFirst(terms: readonly Term[]): Term[] {
	return [...terms.filter((t) => !t.minus), ...terms.filter((t) => t.minus)];
}

/**
 * What the terms amount to.
 *
 * - no term: `null`;
 * - one term added: that term as written (a range stays a range, a fraction
 *   keeps its text);
 * - several terms of one unit (its spellings count as one: `cup` / `cups`):
 *   the sum of their numbers (a range counts for its middle), in the unit of
 *   the first term added;
 * - several units: `null` (the terms do not add up to one amount).
 */
export function termsTotal(terms: readonly Term[]): TermsTotal | null {
	const ordered = addedFirst(terms);
	const [first] = ordered;
	if (!first) return null;
	if (ordered.length === 1 && !first.minus) {
		return { qty: first.value, unit: first.unit };
	}
	const unitKey = normalizeUnit(first.unit);
	let sum = 0;
	for (const term of ordered) {
		if (normalizeUnit(term.unit) !== unitKey) return null;
		const n = termValueNumber(term.value);
		if (n === null) return null;
		sum = term.minus ? sum - n : sum + n;
	}
	return { qty: sum, unit: first.unit };
}

export type MergeMode = "unit";

/**
 * Puts the terms of several amounts of one ingredient together, terms added
 * before terms taken away (`2 tbsp` then `1 cup - 4 tbsp` gives
 * `1 cup`, `2 tbsp`, `- 4 tbsp`, never a term taken away first).
 *
 * `"unit"` keeps every term as it is, one after the other: this is how a
 * section lists an ingredient it uses several times.
 */
export function mergeTerms(terms: readonly Term[], _mode: MergeMode): Term[] {
	return addedFirst(terms);
}

/**
 * Multiplies a value by `factor`, rounded to 2 decimals. The source text of a
 * value (`text`, a fraction's `numerator` / `denominator`) only describes the
 * unscaled value, so it is dropped: a scaled fraction becomes a single value.
 * A value that is not a number (a malformed object) comes back untouched.
 * Throws `QuantityOverflowError` when the product is no longer finite.
 */
export function scaleTermValue<T extends TermValue>(
	value: T,
	factor: number,
): TermValue {
	if (factor === 1) return value;

	const scale = (n: number): number => {
		const scaled = n * factor;
		if (!Number.isFinite(scaled)) throw new QuantityOverflowError(factor);
		return round2(scaled);
	};

	if (typeof value === "number") return scale(value);
	if (!value || typeof value !== "object") return value;

	if (value.type === "single" && typeof value.value === "number") {
		return { ...value, value: scale(value.value), text: undefined };
	}
	if (value.type === "range") {
		return {
			...value,
			value: typeof value.value === "number" ? scale(value.value) : value.value,
			range: value.range
				? { min: scale(value.range.min), max: scale(value.range.max) }
				: value.range,
			text: undefined,
		};
	}
	if (value.type === "fraction" && typeof value.value === "number") {
		return { type: "single", value: scale(value.value) };
	}
	return value;
}

/** Every term multiplied by `factor` (see `scaleTermValue`); units are kept. */
export function scaleTerms(terms: readonly Term[], factor: number): Term[] {
	return terms.map((term) => ({
		...term,
		value: scaleTermValue(term.value, factor),
	}));
}

/** One term as written: its number (or source text) and its unit, without its sign. */
export function formatTerm(term: Term): string {
	const v = term.value;
	const text =
		typeof v === "number"
			? String(v)
			: (v.text ?? String((v as { value?: unknown }).value ?? v));
	return term.unit ? `${text} ${term.unit}` : text;
}

export interface FormatTermsOptions {
	/** Placed between two terms added. Default ` + `. */
	plus?: string;
	/** Placed before a term taken away. Default ` − `. */
	minus?: string;
}

/**
 * The terms as written, terms added first (`1 cup + 1 tbsp`, `1 cup − 2 tbsp`).
 * A list that starts with a term taken away still writes it after the others.
 */
export function formatTerms(
	terms: readonly Term[],
	options: FormatTermsOptions = {},
): string {
	const plus = options.plus ?? " + ";
	const minus = options.minus ?? " − ";
	return addedFirst(terms)
		.map((term, i) => {
			const text = formatTerm(term);
			if (i === 0) return term.minus ? `${minus.trimStart()}${text}` : text;
			return `${term.minus ? minus : plus}${text}`;
		})
		.join("");
}

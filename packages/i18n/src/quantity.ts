/**
 * The one model every amount of an ingredient goes through: a list of terms,
 * each a value and a unit, added or taken away (`1 cup + 1 tbsp`,
 * `1 cup - 2 tbsp`). A plain `{200 g}` is one term.
 *
 * Pure and neutral: it knows nothing of the parser's AST or of the compiled
 * recipe. `@gram-lang/kitchen` reads its usages and AST nodes into terms
 * (`termsOfUsage`, `termsOfAst`) and writes them back (`usageFromTerms`).
 */
import {
	type LadderStep,
	ladderOf,
	normalizeUnit,
	sameLadder,
	UNIT_CONVERSIONS,
} from "./units";

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

/** The lowest and highest number a value stands for (the same for a single value). */
function termBounds(value: TermValue): { min: number; max: number } | null {
	if (typeof value === "number") return { min: value, max: value };
	if (value.type === "range" && value.range) {
		return { min: value.range.min, max: value.range.max };
	}
	const n = termValueNumber(value);
	return n === null ? null : { min: n, max: n };
}

/** Removes the floating-point noise of an exact sum (`0.1 + 0.2` gives `0.3`). */
const exact = (n: number): number => Math.round(n * 1e9) / 1e9;

/**
 * The unit a list of terms adds up in, and how much one of each term's unit
 * weighs in it (`weight / divisor`): see `termsTotal`.
 */
interface CommonUnit {
	unit: string | null;
	weight: (term: Term) => number;
	divisor: number;
	round: (n: number) => number;
}

function commonUnit(ordered: readonly Term[]): CommonUnit | null {
	const [first] = ordered;
	if (!first) return null;

	const firstKey = normalizeUnit(first.unit);
	if (ordered.every((t) => normalizeUnit(t.unit) === firstKey)) {
		return { unit: first.unit, weight: () => 1, divisor: 1, round: exact };
	}

	const units = ordered.map((t) => t.unit);
	if (sameLadder(units)) {
		// Every step is a whole number of the ladder's smallest unit, so the
		// sum is counted in it, then read in the smallest unit written.
		const steps = ordered.map((t) => ladderOf(t.unit) as LadderStep);
		let smallest = 0;
		steps.forEach((step, i) => {
			if (step.size < (steps[smallest] as LadderStep).size) smallest = i;
		});
		return {
			unit: (ordered[smallest] as Term).unit,
			weight: (t) => (ladderOf(t.unit) as LadderStep).size,
			divisor: (steps[smallest] as LadderStep).size,
			round: exact,
		};
	}

	for (const family of [UNIT_CONVERSIONS.mass, UNIT_CONVERSIONS.volume]) {
		const factors = units.map((u) => family.map[normalizeUnit(u)]);
		if (factors.every((f) => f !== undefined)) {
			return {
				unit: family.base,
				weight: (t) => family.map[normalizeUnit(t.unit)] as number,
				divisor: 1,
				round: round2,
			};
		}
	}
	return null;
}

/**
 * What the terms amount to.
 *
 * - no term: `null`;
 * - one term added: that term as written (a range stays a range, a fraction
 *   keeps its text);
 * - several terms of one unit (its spellings count as one: `cup` / `cups`):
 *   their sum in that unit, never converted (`1 tasse + 1 tasse` is
 *   `2 tasses`), spelled as the first term added;
 * - several units of one ladder (`UNIT_LADDERS`): their exact sum in the
 *   smallest unit written (`1 cup + 1 tbsp` is `17 tbsp`);
 * - several units of one family across systems (`cup` and `ml`, `oz` and
 *   `g`): their sum in grams or milliliters, rounded to 2 decimals;
 * - otherwise (`cup` and `g`, `gousse` and `pièce`, a term with no unit next
 *   to one with a unit): `null`, the terms do not add up to one amount.
 *
 * A range is added by its bounds (`2-3 g + 200 g` is `202-203 g`): a term
 * taken away removes its highest number from the lowest bound and its lowest
 * number from the highest one. A total with a range in it stays a range.
 */
export function termsTotal(terms: readonly Term[]): TermsTotal | null {
	const ordered = addedFirst(terms);
	const [first] = ordered;
	if (!first) return null;
	if (ordered.length === 1 && !first.minus) {
		return { qty: first.value, unit: first.unit };
	}

	const common = commonUnit(ordered);
	if (!common) return null;

	let min = 0;
	let max = 0;
	let isRange = false;
	for (const term of ordered) {
		const bounds = termBounds(term.value);
		if (!bounds) return null;
		if (typeof term.value === "object" && term.value.type === "range") {
			isRange = true;
		}
		const weight = common.weight(term);
		if (term.minus) {
			min -= bounds.max * weight;
			max -= bounds.min * weight;
		} else {
			min += bounds.min * weight;
			max += bounds.max * weight;
		}
	}
	min = common.round(min / common.divisor);
	max = common.round(max / common.divisor);

	if (!isRange) return { qty: min, unit: common.unit };
	return {
		qty: { type: "range", value: exact((min + max) / 2), range: { min, max } },
		unit: common.unit,
	};
}

export type MergeMode = "unit" | "ladder";

/** A total read back as one term: a negative total becomes a term taken away. */
function totalAsTerm(total: TermsTotal): Term {
	const { qty, unit } = total;
	if (typeof qty === "number") {
		return qty < 0 ? { value: -qty, unit, minus: true } : { value: qty, unit };
	}
	if (qty.type === "range" && qty.range.max < 0) {
		const min = -qty.range.max;
		const max = -qty.range.min;
		return {
			value: {
				type: "range",
				value: exact((min + max) / 2),
				range: { min, max },
			},
			unit,
			minus: true,
		};
	}
	return { value: qty, unit };
}

/**
 * Puts the terms of several amounts of one ingredient together, terms added
 * before terms taken away (`2 tbsp` then `1 cup - 4 tbsp` gives
 * `1 cup`, `2 tbsp`, `- 4 tbsp`, never a term taken away first).
 *
 * - `"unit"` keeps every term as it is, one after the other: this is how a
 *   section lists an ingredient it uses several times.
 * - `"ladder"` adds up the terms of each ladder into one, in the smallest
 *   unit written (`1 cup`, `2 tbsp` and `- 4 tbsp` give `14 tbsp`, see
 *   `termsTotal`), and the terms of each unit on no ladder into one; two
 *   systems (`cup` and `ml`) or two families stay apart. Each result keeps
 *   the place of the first term it adds up; a negative result is a term
 *   taken away.
 */
export function mergeTerms(terms: readonly Term[], mode: MergeMode): Term[] {
	const ordered = addedFirst(terms);
	if (mode === "unit") return ordered;

	const groups = new Map<string, Term[]>();
	for (const term of ordered) {
		const step = ladderOf(term.unit);
		const key = step
			? `ladder:${step.ladder.id}`
			: `unit:${normalizeUnit(term.unit)}`;
		const group = groups.get(key);
		if (group) group.push(term);
		else groups.set(key, [term]);
	}

	const merged: Term[] = [];
	for (const group of groups.values()) {
		const total = group.length > 1 ? termsTotal(group) : null;
		if (total) merged.push(totalAsTerm(total));
		else merged.push(...group);
	}
	return addedFirst(merged);
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

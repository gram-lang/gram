import type { QuantityValueAST } from "./types";

/**
 * The parser's number/fraction layer, isolated from the Ohm grammar actions
 * that call it (audit 2026-07-22, parser finding P3): every function here
 * takes and returns plain values, so it's unit-testable without invoking the
 * parser, and gives a Rust port an obvious, self-contained unit of
 * translation for exactly the part of the parser most likely to need
 * careful, tested numeric behavior (float parsing, rounding).
 */

/**
 * Unicode vulgar fraction glyphs, mapped to [numerator, denominator].
 */
export const UNICODE_FRACTIONS: Record<string, [number, number]> = {
	"¼": [1, 4],
	"½": [1, 2],
	"¾": [3, 4],
	"⅓": [1, 3],
	"⅔": [2, 3],
	"⅕": [1, 5],
	"⅖": [2, 5],
	"⅗": [3, 5],
	"⅘": [4, 5],
	"⅙": [1, 6],
	"⅚": [5, 6],
	"⅛": [1, 8],
	"⅜": [3, 8],
	"⅝": [5, 8],
	"⅞": [7, 8],
};

/**
 * Looks up a Unicode vulgar fraction glyph. Safe to call unguarded on any
 * string matched by the `unicodeFractionChar` grammar rule, which only
 * accepts glyphs present in this table.
 */
export function unicodeFractionValue(glyph: string): [number, number] {
	const pair = UNICODE_FRACTIONS[glyph];
	if (!pair) throw new Error(`Unknown unicode fraction glyph: ${glyph}`);
	return pair;
}

/**
 * Parses a fractional or decimal string into a value object, e.g.
 * "1/2" -> { type: 'fraction', value: 0.5, ... }.
 *
 * Returns `null` when the string is empty, or when the fraction's
 * denominator is 0 (audit 2026-07-22, parser finding B3: `1/0` used to
 * produce `value: Infinity`, which `JSON.stringify` silently serializes to
 * `null` anyway — reject it here instead of constructing a node that lies
 * about having a usable numeric value).
 */
export function parseNumber(n: string): QuantityValueAST | null {
	if (!n) return null;
	const parts = n.split("/");
	const numStr = parts[0];
	const denStr = parts[1];
	if (numStr && denStr) {
		// Audit finding B3: the numerator can be a decimal per the grammar
		// (`plainNumber = digit+ ("." digit+)? ("/" digit+)?`), but this used
		// `parseInt`, which truncates — "1.5/2" silently became 1/2 (0.5)
		// instead of 0.75.
		const num = parseFloat(numStr);
		const den = parseFloat(denStr);
		if (den === 0) return null;
		return {
			type: "fraction",
			value: num / den,
			numerator: num,
			denominator: den,
			text: n,
		};
	}
	return { type: "single", value: parseFloat(n), text: n };
}

/**
 * Combines a whole-number part with a numerator/denominator into a single
 * mixed-fraction value (e.g. "1 1/2" -> 1.5, or "1½" via a Unicode glyph).
 * Shared by the grammar's `mixedFraction` and `unicodeFraction_mixed`
 * actions, which previously duplicated this same arithmetic.
 */
export function makeMixedFraction(
	whole: number,
	numerator: number,
	denominator: number,
	text: string,
): QuantityValueAST {
	return {
		type: "fraction",
		value: whole + numerator / denominator,
		numerator: whole * denominator + numerator,
		denominator,
		text,
	};
}

/**
 * Builds a `range` value from two already-parsed endpoints, averaging them
 * into `.value` while keeping the explicit bounds in `.range` — a diff or
 * display that only looked at `.value` would see `{2-3}` and `{1-4}}` as
 * identical (same average), which is why both are always carried.
 */
export function makeRange(
	min: QuantityValueAST,
	max: QuantityValueAST,
	text: string,
): QuantityValueAST | null {
	if (!min || !max) return null;
	const minValue = min.value as number;
	const maxValue = max.value as number;
	return {
		type: "range",
		value: (minValue + maxValue) / 2,
		range: { min: minValue, max: maxValue },
		text,
	};
}

import type { QuantityValueAST } from "@gram-lang/parser";
import type { PercentFormula, RatioFormula, RatioSpec } from "./types";

/**
 * How a shopping entry writes an amount Gram could not count: a share
 * (`12,5% of flour`), a ratio waiting for its target (`1,5 / 100 g @&flour`).
 * Written from the values the parser read, never from the source spelling,
 * so `gram format` (which trims `1.50` to `1.5` and respaces `15g/ L`)
 * leaves the compiled recipe as it was (#225). The decimal separator stays
 * the author's: a comma between two digits in the source is kept.
 */

/** The separator a number written as `text` uses: `,` or `.`. */
export function separatorOf(text: string | undefined): "," | "." {
	return text && /\d,\d/.test(text) ? "," : ".";
}

/** A number, with the author's decimal separator. */
export function writeNumber(n: number, separator: "," | "."): string {
	const text = String(n);
	return separator === "," ? text.replace(".", ",") : text;
}

/**
 * A number as the parser read it. A fraction keeps its spelling (`1/2`,
 * `1 ½`): the formatter never rewrites one. A range is written from its
 * bounds (`1,5-2`).
 */
export function writeValue(
	value: QuantityValueAST,
	separator: "," | ".",
): string {
	if (value.type === "fraction") return value.text || String(value.value);
	if (value.type === "range") {
		if (value.text?.includes("/")) return value.text;
		const { min, max } = value.range;
		return `${writeNumber(min, separator)}-${writeNumber(max, separator)}`;
	}
	return writeNumber(value.value, separator);
}

/** A share of a target: `12,5% of flour`. */
export function shareText(
	percent: number,
	text: string | undefined,
	target: string,
): string {
	return `${writeNumber(percent, separatorOf(text))}% of ${target}`;
}

/**
 * A ratio: `1,5 / 100 g @&flour`, `15 g / L @&water`, `1 / @&cutlet`. A
 * denominator of 1 is not written (`/ 1 L` reads `/ L`): the compiled
 * ratio does not say whether the author wrote it. A timer's ratio (no
 * numerator value) keeps its text.
 */
export function ratioText(spec: RatioSpec): string {
	if (!spec.numerator.value) return spec.raw;
	const separator = separatorOf(spec.raw);
	const numerator = [writeValue(spec.numerator.value, separator)];
	if (spec.numerator.unit) numerator.push(spec.numerator.unit);
	const denominator: string[] = [];
	if (spec.denominator.value !== 1) {
		denominator.push(writeNumber(spec.denominator.value, separator));
	}
	if (spec.denominator.unit) denominator.push(spec.denominator.unit);
	const sigil = spec.referenceType === "ingredient" ? "@&" : "&";
	return [
		numerator.join(" "),
		"/",
		...denominator,
		`${sigil}${spec.target}`,
	].join(" ");
}

/** What a share or a ratio adds to a shopping entry, unresolved. */
export function formulaText(formula: PercentFormula | RatioFormula): string {
	return "ratio" in formula ? ratioText(formula.ratio) : formula.raw;
}

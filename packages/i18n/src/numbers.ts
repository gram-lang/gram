/**
 * Numbers as a reader of a language writes them: `1.5` in English, `1,5` in
 * French. Only for what is shown: a number a script or a file reads back (a
 * data attribute, JSON, `.gram` source) keeps its point.
 */

import { normalizeUnit } from "./units";

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(lang: string | undefined, maxDecimals: number) {
	const key = `${lang ?? "en"}|${maxDecimals}`;
	let format = formatters.get(key);
	if (!format) {
		const options: Intl.NumberFormatOptions = {
			maximumFractionDigits: maxDecimals,
			// "1500 g", as a recipe writes it: no thousands separator, which
			// would also read as a decimal comma in English.
			useGrouping: false,
		};
		try {
			format = new Intl.NumberFormat(lang || "en", options);
		} catch {
			format = new Intl.NumberFormat("en", options);
		}
		formatters.set(key, format);
	}
	return format;
}

/**
 * A number in the reader's language, rounded to `maxDecimals` (2 by default),
 * with no thousands separator: `formatNumber(1.5, "fr")` is `"1,5"`,
 * `formatNumber(1500, "fr")` is `"1500"`.
 */
export function formatNumber(
	value: number,
	lang?: string,
	maxDecimals = 2,
): string {
	return formatter(lang, maxDecimals).format(value);
}

/** The decimal separator of a language: `"."` in English, `","` in French. */
export function decimalSeparator(lang?: string): string {
	return (
		formatter(lang, 1)
			.formatToParts(1.5)
			.find((part) => part.type === "decimal")?.value ?? "."
	);
}

/**
 * The decimal separators of a quantity already written as text (a range
 * `1.5-2`, a timer `1,5`) in the reader's language: `"1,5-2"` in French,
 * `"1.5"` in English. Gram reads a point or a comma between two digits as a
 * decimal separator, so both change; `1/2` or a unit stay as they are.
 */
export function localizeDecimals(text: string, lang?: string): string {
	return text.replace(/(\d)[.,](\d)/g, `$1${decimalSeparator(lang)}$2`);
}

/**
 * A comma that a reader could take for a thousands separator: exactly three
 * digits after it and a whole part of one to three digits, not zero
 * (`1,000`, `12,500`). Gram reads it as a decimal (1, 12.5), as it reads every
 * comma between two digits, and has no thousands separator; `0,125` or
 * `1,25` cannot be one. The point is not concerned: it has always been a
 * decimal in Gram, so `1.000` keeps meaning 1.
 */
export function looksLikeThousands(text: string): boolean {
	return /(?<![\d.,])(?!0+,)\d{1,3},\d{3}(?![\d.,])/.test(text);
}

/** The fractions a cook reads on a spoon or a cup, from 1/8 to 7/8. */
const COMMON_FRACTIONS = [
	{ value: 0.5, text: "1/2" },
	{ value: 0.25, text: "1/4" },
	{ value: 0.75, text: "3/4" },
	{ value: 1 / 3, text: "1/3" },
	{ value: 2 / 3, text: "2/3" },
	{ value: 0.125, text: "1/8" },
	{ value: 0.375, text: "3/8" },
	{ value: 0.625, text: "5/8" },
	{ value: 0.875, text: "7/8" },
];

/** `"1/4"` for a value strictly between 0 and 1 that is (nearly) a common fraction. */
export function commonFraction(value: number): string | undefined {
	if (value <= 0 || value >= 1) return undefined;
	return COMMON_FRACTIONS.find((f) => Math.abs(value - f.value) < 0.01)?.text;
}

/**
 * The units measured with a spoon, a cup or an imperial measure, where a cook
 * writes `1 3/4 cup` rather than `1.75 cup`. Metric units keep decimals
 * (`1,5 kg`): a scale shows them, and `1 1/2 kg` would read oddly.
 */
const FRACTION_UNITS = new Set([
	"tsp",
	"tbsp",
	"tad",
	"dash",
	"pinch",
	"smidgen",
	"drop",
	"cup",
	"tasse",
	"fl oz",
	"pt",
	"qt",
	"gal",
	"oz",
	"lb",
]);

/** True for a unit read in fractions (spoons, cups, imperial measures). */
export function isFractionUnit(
	rawUnit: string | undefined | null,
	lang?: string,
): boolean {
	return FRACTION_UNITS.has(normalizeUnit(rawUnit, lang));
}

/**
 * A quantity of a spoon, cup or imperial unit as a cook writes it: a whole
 * number and a common fraction (`1.75` cup → `"1 3/4"`, `0.5` tsp → `"1/2"`),
 * or `undefined` when it is not near one (`1.6`), or for any other unit:
 * the caller then writes a decimal.
 */
export function toKitchenFraction(
	value: number,
	rawUnit: string | undefined | null,
	lang?: string,
): string | undefined {
	if (!isFractionUnit(rawUnit, lang) || value <= 0) return undefined;
	const whole = Math.floor(value);
	const fraction = commonFraction(value - whole);
	if (!fraction) return undefined;
	return whole > 0 ? `${whole} ${fraction}` : fraction;
}

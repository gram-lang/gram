/**
 * The one model every amount of an ingredient goes through: a list of terms,
 * each a value and a unit, added or taken away (`1 cup + 1 tbsp`,
 * `1 cup - 2 tbsp`). A plain `{200 g}` is one term.
 *
 * Pure and neutral: it knows nothing of the parser's AST or of the compiled
 * recipe. `@gram-lang/kitchen` reads its usages and AST nodes into terms
 * (`termsOfUsage`, `termsOfAst`) and writes them back (`usageFromTerms`).
 */
import { formatNumber, toKitchenFraction } from "./numbers";
import {
	type LadderStep,
	ladderOf,
	normalizeUnit,
	sameLadder,
	toLargerMetricUnit,
	UNIT_CONVERSIONS,
	unitSpelling,
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
function addedFirst<T extends { minus?: boolean }>(terms: readonly T[]): T[] {
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
 * The key `mergeTerms` groups a term's unit under: its ladder in `"ladder"`
 * mode (`cup` and `tbsp`, `g` and `kg`), otherwise the unit itself, its
 * spellings counted as one (`cup` / `cups`). A unit Gram does not know
 * (`gousse`) is only lowercased: `gousse` and `gousses` stay two units.
 */
export function mergeKey(unit: string | null, mode: MergeMode): string {
	const step = mode === "ladder" ? ladderOf(unit) : null;
	return step ? `ladder:${step.ladder.id}` : `unit:${normalizeUnit(unit)}`;
}

/** The terms grouped by `mergeKey`, groups in the order their first term comes. */
export function groupTerms(terms: readonly Term[], mode: MergeMode): Term[][] {
	const groups = new Map<string, Term[]>();
	for (const term of terms) {
		const key = mergeKey(term.unit, mode);
		const group = groups.get(key);
		if (group) group.push(term);
		else groups.set(key, [term]);
	}
	return [...groups.values()];
}

/** True for a total of exactly nothing (`2 tbsp - 2 tbsp`). */
function isZero(term: Term): boolean {
	const bounds = termBounds(term.value);
	return !!bounds && bounds.min === 0 && bounds.max === 0;
}

/**
 * Puts the terms of several amounts of one ingredient together, terms added
 * before terms taken away (`2 tbsp` then `1 cup - 4 tbsp` gives
 * `1 cup - 2 tbsp`, never a term taken away first).
 *
 * - `"unit"` adds up the terms of each unit into one, its spellings counted
 *   as one (`100 g` and `100 g` give `200 g`); two units stay apart, even on
 *   one ladder (`1 cup`, `2 tbsp`): this is how a section lists an
 *   ingredient it uses several times.
 * - `"ladder"` adds up the terms of each ladder into one, in the smallest
 *   unit written (`1 cup`, `2 tbsp` and `- 4 tbsp` give `14 tbsp`, see
 *   `termsTotal`), and the terms of each unit on no ladder into one; two
 *   systems (`cup` and `ml`) or two families stay apart.
 *
 * Each result keeps the place of the first term it adds up; a negative
 * result is a term taken away, a result of zero is left out (unless nothing
 * else is left). A lone term stays as written.
 */
export function mergeTerms(terms: readonly Term[], mode: MergeMode): Term[] {
	const merged: Term[] = [];
	for (const group of groupTerms(addedFirst(terms), mode)) {
		const total = group.length > 1 ? termsTotal(group) : null;
		if (total) merged.push(totalAsTerm(total));
		else merged.push(...group);
	}
	const kept = merged.filter((term) => !isZero(term));
	return addedFirst(kept.length > 0 ? kept : merged.slice(0, 1));
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

/** How `formatTerms` writes the numbers and texts of the terms. */
interface TermWriter {
	number: (value: number, unit: string | null) => string;
	text: (text: string) => string;
}

/** One term's number (or source text): a range without its text by its bounds. */
function writeValue(
	value: TermValue,
	unit: string | null,
	w: TermWriter,
): string {
	if (typeof value === "number") return w.number(value, unit);
	if (value.text != null) return w.text(value.text);
	// A range without its source text (added up, scaled) shows its bounds,
	// never its middle.
	if (value.type === "range" && value.range) {
		return `${w.number(value.range.min, unit)}-${w.number(value.range.max, unit)}`;
	}
	const n = termValueNumber(value);
	return n === null ? String(value) : w.number(n, unit);
}

function writeTerm(term: Term, w: TermWriter): string {
	const text = writeValue(term.value, term.unit, w);
	if (!term.unit) return text;
	// A percentage (a term Gram refused, `10%`) sticks to its number.
	return term.unit === "%" ? `${text}%` : `${text} ${term.unit}`;
}

const RAW_WRITER: TermWriter = { number: (n) => String(n), text: (t) => t };

/** One term as written: its number (or source text) and its unit, without its sign. */
export function formatTerm(term: Term): string {
	return writeTerm(term, RAW_WRITER);
}

export interface FormatTermsOptions {
	/** Placed between two terms added. Default ` + `. */
	plus?: string;
	/** Placed before a term taken away. Default ` − `. */
	minus?: string;
	/**
	 * `"written"` (default): the terms as the author wrote them.
	 * `"computed"`: an amount Gram worked out (scaled, or added up from
	 * several occurrences), written the way a cook measures it (see
	 * `formatTerms`).
	 */
	mode?: "written" | "computed";
	/** The reader's language: decimals, and the spelling of a unit Gram brings in. */
	lang?: string;
	/**
	 * Writes a number next to its unit. Default: the number as it is in
	 * `"written"` mode; in `"computed"` mode a whole number, a kitchen
	 * fraction for a spoon or an imperial unit (`1 1/2`), otherwise a
	 * decimal in the reader's language.
	 */
	number?: (value: number, unit: string | null) => string;
	/** Writes a value's source text (`1/2`, `2.5-3`). Default: as it is. */
	text?: (text: string) => string;
	/**
	 * `"computed"` only: an amount the reader buys (a shopping list). A
	 * metric amount reaches the larger unit (`1500 g` is `1.5 kg`), and a
	 * spoon or imperial amount is recomposed from the top of its scale
	 * (`34 tbsp` is `2 cup + 2 tbsp`) once it reaches one of a unit at least
	 * four times larger than its own (`3 tsp` stays `3 tsp`).
	 */
	buying?: boolean;
	/**
	 * `"computed"` only, default `true`: a recomposition may round its last
	 * term to what its unit measures (a scaled amount was no exact measure
	 * anyway: `1.1 cup` is `1 cup + 1 tbsp + 2 tsp`). `false` writes an
	 * amount that does not recompose exactly as it is (`1.6 cup`).
	 */
	rounding?: boolean;
}

/** A piece of a formatted amount: its text, unit included, and its sign. */
interface Piece {
	text: string;
	minus?: boolean;
}

/**
 * The fractions a kitchen measure really measures, by canonical unit: a
 * recomposed amount keeps a fraction only when the spoon, the cup or the
 * scale has it (`2 tbsp` never becomes `1/8 cup`).
 */
const MEASURED_FRACTIONS: Readonly<Record<string, readonly number[]>> = {
	cup: [1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4],
	tbsp: [1 / 2],
	tsp: [1 / 8, 1 / 4, 1 / 2],
	"fl oz": [1 / 2],
	pt: [1 / 2],
	qt: [1 / 2],
	gal: [1 / 2],
	lb: [1 / 4, 1 / 2],
	oz: [1 / 4, 1 / 2, 3 / 4],
};

/**
 * The scales an amount is recomposed along, largest unit first: spoons and
 * liquid measures stay apart, though both are on the US volume ladder.
 */
const RECOMPOSE_CHAINS: readonly (readonly string[])[] = [
	["cup", "tbsp", "tsp"],
	["gal", "qt", "pt", "fl oz"],
	["lb", "oz"],
];

/** How close a value must be to a measured one to be read as it (as `commonFraction`). */
const TOLERANCE = 0.01;

/** The values `unit` measures around `value`: whole numbers plus its fractions. */
function measuredCandidates(value: number, unit: string): number[] {
	const whole = Math.floor(value);
	const fractions = [0, ...(MEASURED_FRACTIONS[unit] ?? []), 1];
	return fractions.map((f) => whole + f);
}

/** `value` read as an amount `unit` measures (`1.5` cup), or `undefined`. */
function measured(value: number, unit: string): number | undefined {
	if (value <= 0) return undefined;
	return measuredCandidates(value, unit).find(
		(c) => c > 0 && Math.abs(value - c) < TOLERANCE,
	);
}

/**
 * The amount `unit` measures nearest `value`, never below its smallest
 * fraction. The last term of a recomposed amount can be measured with
 * several spoons, so any multiple of the smallest fraction counts
 * (`3/4 tsp` is `1/2 tsp` and `1/4 tsp`, never rounded down to `1/2 tsp`).
 */
function nearestMeasured(value: number, unit: string): number {
	const smallest = Math.min(...(MEASURED_FRACTIONS[unit] ?? [1]));
	const whole = Math.floor(value);
	const multiples = Array.from(
		{ length: Math.round(1 / smallest) + 1 },
		(_, k) => whole + k * smallest,
	);
	let best = 0;
	for (const c of [...measuredCandidates(value, unit), ...multiples]) {
		if (Math.abs(value - c) < Math.abs(value - best) - 1e-9) best = c;
	}
	if (best > 0) return best;
	return smallest;
}

/**
 * An amount, counted in its ladder's smallest unit, recomposed along `chain`
 * (largest unit first): a measured fraction of a unit ends it, otherwise
 * whole units then the rest in the next one, three terms at most, the last
 * rounded to what its unit measures.
 */
function decompose(
	total: number,
	chain: readonly string[],
	steps: Readonly<Record<string, number>>,
): { value: number; unit: string }[] {
	const out: { value: number; unit: string }[] = [];
	let rest = total;
	for (let i = 0; i < chain.length; i++) {
		const unit = chain[i] as string;
		const size = steps[unit] as number;
		const value = rest / size;
		if (i === chain.length - 1 || out.length === 2) {
			if (value > TOLERANCE / 10 || out.length === 0) {
				out.push({ value: nearestMeasured(value, unit), unit });
			}
			break;
		}
		const exactly = measured(value, unit);
		if (exactly !== undefined) {
			out.push({ value: exactly, unit });
			break;
		}
		// The largest unit takes the largest amount it measures, fraction
		// included (`1 1/2 cup + 1 1/2 tbsp`, not `1 cup + 9 1/2 tbsp`); the
		// units below take whole ones.
		const whole =
			i === 0
				? Math.max(
						0,
						...measuredCandidates(value, unit).filter((c) => c <= value + 1e-9),
					)
				: Math.floor(value + 1e-9);
		if (whole > 0) {
			out.push({ value: whole, unit });
			rest -= whole * size;
		}
		if (rest <= 1e-9) break;
	}
	return out;
}

/** True when the recomposed parts add up to `total` (no term was rounded). */
function recomposesExactly(
	parts: readonly { value: number; unit: string }[],
	total: number,
	steps: Readonly<Record<string, number>>,
): boolean {
	const last = parts[parts.length - 1];
	if (!last) return false;
	const sum = parts.reduce(
		(n, p) => n + p.value * (steps[p.unit] as number),
		0,
	);
	return Math.abs(sum - total) < TOLERANCE * (steps[last.unit] as number);
}

/** The lowest and highest totals of a list of terms, in their ladder's smallest unit. */
function ladderBounds(
	terms: readonly Term[],
	size: (term: Term) => number,
): { min: number; max: number } | null {
	let min = 0;
	let max = 0;
	for (const term of terms) {
		const bounds = termBounds(term.value);
		if (!bounds) return null;
		const s = size(term);
		if (term.minus) {
			min -= bounds.max * s;
			max -= bounds.min * s;
		} else {
			min += bounds.min * s;
			max += bounds.max * s;
		}
	}
	return { min: exact(min), max: exact(max) };
}

/**
 * True when the terms of one ladder can be measured as they are: one term per
 * unit, each an amount its unit measures, none worth a larger unit written
 * next to it (`20 tbsp` beside `1 cup`), and a total above zero.
 */
function measuredAsTheyAre(
	terms: readonly Term[],
	canonical: (term: Term) => string,
	steps: Readonly<Record<string, number>>,
): boolean {
	const units = terms.map(canonical);
	if (new Set(units).size !== units.length) return false;
	const sizes = terms
		.filter((t) => !t.minus)
		.map((t) => steps[canonical(t)] as number);
	return terms.every((term) => {
		const bounds = termBounds(term.value);
		if (!bounds) return false;
		const unit = canonical(term);
		if (measured(bounds.min, unit) === undefined) return false;
		if (measured(bounds.max, unit) === undefined) return false;
		if (term.minus) return true;
		const size = steps[unit] as number;
		const larger = sizes.filter((s) => s > size);
		return larger.length === 0 || bounds.max * size < Math.min(...larger);
	});
}

/**
 * The pieces of one group of terms in `"computed"` mode: a group is one
 * ladder (`cup` and `tbsp`, `g` and `kg`) or one unit on no ladder.
 */
function computedGroup(
	group: readonly Term[],
	w: TermWriter,
	options: FormatTermsOptions,
): Piece[] {
	const { lang, buying } = options;
	const asWritten = (): Piece[] =>
		addedFirst(group).map((t) => ({ text: writeTerm(t, w), minus: t.minus }));

	const first = group[0] as Term;
	const step = ladderOf(first.unit, lang);
	if (!step) {
		return mergeTerms(group, "unit").map((t) => ({
			text: writeTerm(t, w),
			minus: t.minus,
		}));
	}

	const { steps } = step.ladder;
	const canonical = (t: Term) => (ladderOf(t.unit, lang) as LadderStep).unit;
	const size = (t: Term) => steps[canonical(t)] as number;
	const total = ladderBounds(group, size);
	if (!total || total.min <= 0) return asWritten();

	// The largest unit written; its spelling as written, or the reader's.
	let cap = first;
	for (const t of group) if (size(t) > size(cap)) cap = t;
	const capUnit = canonical(cap);
	const spell = (unit: string): string =>
		group.find((t) => canonical(t) === unit)?.unit ?? unitSpelling(unit, lang);
	const write = (value: number, unit: string): string =>
		`${w.number(value, unit)} ${unit}`;
	const span = (min: string, max: string, unit: string): string =>
		min === max ? `${min} ${unit}` : `${min}-${max} ${unit}`;

	// Metric: one decimal amount in the largest unit written (`1 kg + 200 g`
	// is `1.2 kg`, `800 g + 200 g` is `1000 g`), in the larger unit for a
	// shopping list.
	if (step.ladder.id === "metricMass" || step.ladder.id === "metricVolume") {
		const written = cap.unit as string;
		const capSize = steps[capUnit] as number;
		const larger = buying
			? toLargerMetricUnit(total.max / capSize, written, lang).unit
			: written;
		const unit = larger === written ? written : larger;
		const unitSize = larger === written ? capSize : (steps[larger] as number);
		// A larger unit reads as `toLargerMetricUnit` writes it (`2.25 l`), as
		// every surface writes a shopping list.
		const num = (n: number) =>
			larger === written ? w.number(n, unit) : formatNumber(round2(n), lang);
		const lo = num(total.min / unitSize);
		const hi = num(total.max / unitSize);
		return [{ text: span(lo, hi, unit) }];
	}

	const chain = RECOMPOSE_CHAINS.find((c) => c.includes(capUnit));
	if (!chain) return asWritten();
	// What is bought climbs to a much larger unit it reaches or measures
	// (`34 tbsp` is over a cup, `12 tbsp` is `3/4 cup`), never to a near one
	// (`3 tsp` stays in teaspoons).
	const capSize = steps[capUnit] as number;
	const climbed = buying
		? chain.find((u) => {
				const size = steps[u] as number;
				return (
					size >= 4 * capSize &&
					(total.min >= size || measured(total.min / size, u) !== undefined)
				);
			})
		: undefined;
	const from = chain.slice(chain.indexOf(climbed ?? capUnit));
	const top = from[0] as string;
	const topSize = steps[top] as number;

	// One amount of the top unit, when it measures it (`2 cup - 4 tbsp` is
	// `1 3/4 cup`).
	const lo = measured(total.min / topSize, top);
	const hi = measured(total.max / topSize, top);
	if (lo !== undefined && hi !== undefined) {
		const unit = spell(top);
		return [{ text: span(w.number(lo, top), w.number(hi, top), unit) }];
	}
	if (!buying && measuredAsTheyAre(group, canonical, steps)) return asWritten();

	const a = decompose(total.min, from, steps);
	let b = decompose(total.max, from, steps);
	// A range keeps the shape of its low bound when the high one fits it
	// (`2 cup + 2-4 tbsp`, not `2 cup + 2 tbsp – 2 1/4 cup`).
	const lastLow = a[a.length - 1];
	if (lastLow && total.max !== total.min) {
		const prefix = a.slice(0, -1);
		const used = prefix.reduce(
			(n, p) => n + p.value * (steps[p.unit] as number),
			0,
		);
		const rest = (total.max - used) / (steps[lastLow.unit] as number);
		const fits = measured(rest, lastLow.unit);
		if (fits !== undefined)
			b = [...prefix, { value: fits, unit: lastLow.unit }];
	}
	if (
		options.rounding === false &&
		!(
			recomposesExactly(a, total.min, steps) &&
			recomposesExactly(b, total.max, steps)
		)
	) {
		return asWritten();
	}
	const joinParts = (parts: { value: number; unit: string }[]) =>
		parts.map((p) => write(p.value, spell(p.unit))).join(options.plus ?? " + ");
	const same = (i: number) =>
		a[i]?.unit === b[i]?.unit && a[i]?.value === b[i]?.value;
	if (a.length === b.length && a.every((_, i) => same(i))) {
		return a.map((p) => ({ text: write(p.value, spell(p.unit)) }));
	}
	// The part both bounds share once, the range on the last term
	// (`2 cup + 2-4 tbsp`).
	const last = a.length - 1;
	if (
		a.length === b.length &&
		a[last]?.unit === b[last]?.unit &&
		a.slice(0, last).every((_, i) => same(i))
	) {
		const lastA = a[last] as { value: number; unit: string };
		const lastB = b[last] as { value: number; unit: string };
		return [
			...a.slice(0, last).map((p) => ({ text: write(p.value, spell(p.unit)) })),
			{
				text: span(
					w.number(lastA.value, lastA.unit),
					w.number(lastB.value, lastB.unit),
					spell(lastA.unit),
				),
			},
		];
	}
	return [{ text: `${joinParts(a)} – ${joinParts(b)}` }];
}

/** The default number of `"computed"` mode: whole, kitchen fraction, or decimal. */
function computedNumber(lang?: string) {
	return (value: number, unit: string | null): string => {
		if (Math.abs(value - Math.round(value)) < TOLERANCE) {
			return String(Math.round(value));
		}
		return (
			toKitchenFraction(value, unit, lang) ?? formatNumber(round2(value), lang)
		);
	};
}

/**
 * The terms as text, terms added first (`1 cup + 1 tbsp`, `1 cup − 2 tbsp`).
 * A list that starts with a term taken away still writes it after the others.
 *
 * `"written"` mode (the default) writes each term as the author wrote it.
 * `"computed"` mode writes an amount Gram worked out, ladder by ladder (two
 * systems stay apart, term by term):
 *
 * - a spoon, cup or imperial amount is recomposed the way a cook measures
 *   it: one amount of the largest unit written when that unit measures it
 *   (`MEASURED_FRACTIONS`: `1 1/2 cup`, never `2 1/8 cup`), the terms as they
 *   are when each is measurable, otherwise whole units then the rest in the
 *   next unit down (`cup`, `tbsp`, `tsp`; `gal`, `qt`, `pt`, `fl oz`; `lb`,
 *   `oz`), never above the largest unit written, three terms at most;
 * - a metric amount is one decimal amount in the largest unit written
 *   (`1 kg + 200 g` doubled is `2.4 kg`; `800 g + 200 g` is `1000 g`, never
 *   `1 kg`, unless `buying`);
 * - a range shares what both bounds have in common and puts the range on
 *   the last term (`2 cup + 2-4 tbsp`), otherwise writes each bound in full;
 * - a unit on no ladder adds up with itself only (`2 gousses`).
 */
export function formatTerms(
	terms: readonly Term[],
	options: FormatTermsOptions = {},
): string {
	const plus = options.plus ?? " + ";
	const minus = options.minus ?? " − ";
	const computed = options.mode === "computed";
	const w: TermWriter = {
		number:
			options.number ??
			(computed ? computedNumber(options.lang) : RAW_WRITER.number),
		text: options.text ?? RAW_WRITER.text,
	};
	const pieces: Piece[] = computed
		? groupTerms(addedFirst(terms), "ladder").flatMap((group) =>
				computedGroup(group, w, options),
			)
		: terms.map((term) => ({ text: writeTerm(term, w), minus: term.minus }));
	return addedFirst(pieces)
		.map((piece, i) => {
			if (i === 0)
				return piece.minus ? `${minus.trimStart()}${piece.text}` : piece.text;
			return `${piece.minus ? minus : plus}${piece.text}`;
		})
		.join("");
}

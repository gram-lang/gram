import { ASTNodeType } from "@gram-lang/parser";
import { round2 } from "@gram-lang/kitchen";
import type { AggregatedIngredient, StepToken } from "@gram-lang/kitchen";
import {
	commonFraction,
	formatNumber,
	getDictionary,
	isCoarseUnit,
	localizeDecimals,
	resolveTimeUnit,
	TIME_TO_MINUTES,
	toKitchenFraction,
	toLargerMetricUnit,
} from "@gram-lang/i18n";

/**
 * How a view writes the numbers it shows: in the reader's language (`1,5` in
 * French), or through the integrator's own `formatFraction`.
 */
export interface NumberStyle {
	lang?: string;
	/** `RendererOptions.formatFraction`: replaces the default for a quantity. */
	formatFraction?: (value: number) => string;
}

/**
 * A mass in grams as a view shows it: one decimal, in the reader's language
 * (`147,5 g` in French).
 */
export function formatGrams(grams: number, lang?: string): string {
	return `${formatNumber(grams, lang, 1)} g`;
}

// Converts an AggregatedIngredient to a plain object that formatElement can render.
// The first quantity becomes qty/unit; additional ones become variable_entries strings.
export function aggToRendererItem(
	agg: AggregatedIngredient,
): Record<string, unknown> {
	const base: Record<string, unknown> = { id: agg.id, name: agg.name };
	if (agg.type) base.type = agg.type;
	if (agg.preparation) base.preparation = agg.preparation;
	if (agg.parent) base.parent = agg.parent;
	if (agg.parentPreparation) base.parentPreparation = agg.parentPreparation;
	if (agg.options) base.options = agg.options;
	if (agg.normalizedMass !== undefined)
		base.normalizedMass = agg.normalizedMass;
	if (agg.conversionMethod !== undefined)
		base.conversionMethod = agg.conversionMethod;
	if (agg.isEstimate !== undefined) base.isEstimate = agg.isEstimate;
	if ((agg as any).bakersPercentage !== undefined)
		base.bakersPercentage = (agg as any).bakersPercentage;

	if (!agg.quantities || agg.quantities.length === 0) {
		return base;
	}

	const [first, ...rest] = agg.quantities;
	if (first) {
		base.qty = first.qty;
		base.unit = first.unit ?? null;
	}
	if (rest.length > 0) {
		base.variable_entries = rest.map((q) => {
			const qty = q.qty as any;
			const qStr =
				qty?.text ??
				(typeof qty === "number" ? String(qty) : String(qty?.value ?? qty));
			return q.unit ? `${qStr} ${q.unit}` : qStr;
		});
	}
	return base;
}

// Shared "round to 1 decimal" display precision for mass/volume quantities —
// used for normalizedMass/purchasingMass (already always grams) and, via
// formatDecimalToFraction below, for raw qty+unit display.
export function round1(value: number): number {
	return Math.round(value * 10) / 10;
}

/**
 * "3.9 kg" for 3900 g, "2.25 l" for 2250 ml: an amount of a shopping list or
 * a total in the larger metric unit (`toLargerMetricUnit`), or `undefined`
 * when it stays in the unit it has (under 1000, or not a metric unit). What
 * is weighed (a step, the ingredients of a section, the run sheet) never goes
 * through this: it stays in grams, as a scale shows them.
 */
export function largerAmount(
	value: number,
	unit: string | null | undefined,
	lang?: string,
): string | undefined {
	const larger = toLargerMetricUnit(value, unit, lang);
	return larger.unit !== (unit ?? "")
		? `${formatNumber(larger.value, lang)} ${larger.unit}`
		: undefined;
}

/** "1/4" for a value strictly below 1 that is (nearly) a common fraction. */
export function toCommonFraction(value: number): string | undefined {
	return commonFraction(value);
}

/**
 * A quantity as a cook reads it: a whole number, a common fraction (`1/2`), or
 * a decimal rounded to what the unit needs, in the reader's language (`1,5`
 * in French). An integrator's `formatFraction` replaces all of it.
 */
export function formatDecimalToFraction(
	value: unknown,
	unit?: string,
	style: NumberStyle = {},
): string {
	if (typeof value !== "number") return String(value);
	if (style.formatFraction) return style.formatFraction(value);

	// Exact integers
	if (Math.abs(value - Math.round(value)) < 0.01) {
		return String(Math.round(value));
	}

	// A spoon, a cup, an imperial measure: `1 3/4 cup`, as a cook writes it.
	const kitchen = toKitchenFraction(value, unit, style.lang);
	if (kitchen) return kitchen;

	const fraction = toCommonFraction(value);
	if (fraction) return fraction;

	if (unit && isCoarseUnit(unit)) {
		return formatNumber(round1(value), style.lang, 1);
	}

	return formatNumber(round2(value), style.lang);
}

export interface ExtractedQuantity {
	value: number | string | null;
	text?: string;
	isRelative?: boolean;
}

export function getQty(
	item: Record<string, unknown>,
	style: NumberStyle = {},
): ExtractedQuantity | undefined {
	if (item.qty !== undefined) {
		if (typeof item.qty === "number") {
			return {
				value: item.qty,
				text: formatDecimalToFraction(
					item.qty,
					item.unit as string | undefined,
					style,
				),
			};
		}
		if (
			typeof item.qty === "object" &&
			item.qty !== null &&
			(item.qty as any).type === ASTNodeType.RelativeQuantity
		) {
			const rel = item.qty as any;
			return {
				value: null,
				text: `${rel.percent}% of ${rel.target}`,
				isRelative: true,
			};
		}
		return localizedQuantity(item.qty as ExtractedQuantity, style.lang);
	}
	if (item.quantity)
		return localizedQuantity(item.quantity as ExtractedQuantity, style.lang);
	return undefined;
}

/** A quantity kept as text (`2.5-3`, `1/2`), its decimals in the reader's language. */
function localizedQuantity(
	qty: ExtractedQuantity,
	lang?: string,
): ExtractedQuantity {
	if (!qty || typeof qty !== "object" || typeof qty.text !== "string")
		return qty;
	return { ...qty, text: localizeDecimals(qty.text, lang) };
}

/**
 * Helper to display Timer/Temperature range or value.
 */
export function formatQuantityValue(q: any, lang?: string): string {
	if (!q) return "";
	if (q.text) return localizeDecimals(String(q.text), lang);
	if (q.type === ASTNodeType.RelativeQuantity) {
		return `${q.percent}% of ${q.target}`;
	}
	if (typeof q.value === "number") return formatNumber(q.value, lang);
	if (q.value !== undefined) return String(q.value);
	return String(q);
}

const MINUTES_PER_DAY = 24 * 60;

/**
 * Formats duration values into human readable strings (e.g. 90 -> 1h 30min),
 * with the units of the display language (`durationUnits`: "1j 1h" in French).
 * Compiled timings are floats (20s is 0.333 min), so the value is rounded,
 * and the coarser the duration the coarser the rounding — never a raw
 * decimal: to the second below an hour, to the minute up to a day, to the
 * hour from a day up, where the minutes no longer tell the reader anything.
 * `{ days: false }` keeps hours and minutes however long the duration, for
 * figures that must add up (the breakdown of a total).
 */
export function formatDuration(
	minutes: number,
	lang?: string,
	options: DurationFormatOptions = {},
): string {
	return writeTerms(durationTerms(minutes, lang, options));
}

/** Options of `formatDuration` and `formatDurationRange`. */
export interface DurationFormatOptions {
	/** `false` keeps hours and minutes however long the duration. */
	days?: boolean;
}

/** One term of a displayed duration: `1` and `"h"`. */
interface DurationTerm {
	value: number;
	unit: string;
}

/**
 * Between a number and its unit, a non-breaking space (`10 min`, the
 * international format): the line never breaks inside a term.
 */
const NBSP = " ";

const writeTerms = (terms: DurationTerm[]): string =>
	terms.map((t) => `${t.value}${NBSP}${t.unit}`).join(" ");

/** The terms `formatDuration` writes (one or two, never zero). */
function durationTerms(
	minutes: number,
	lang: string | undefined,
	{ days = true }: DurationFormatOptions,
): DurationTerm[] {
	const u = getDictionary(lang).renderer.durationUnits;
	if (!Number.isFinite(minutes) || minutes <= 0)
		return [{ value: 0, unit: u.minute }];
	const pair = (
		a: number,
		ua: string,
		b: number,
		ub: string,
	): DurationTerm[] =>
		b > 0
			? a > 0
				? [
						{ value: a, unit: ua },
						{ value: b, unit: ub },
					]
				: [{ value: b, unit: ub }]
			: [{ value: a, unit: ua }];
	if (days && Math.round(minutes) >= MINUTES_PER_DAY) {
		const hours = Math.round(minutes / 60);
		return pair(Math.floor(hours / 24), u.day, hours % 24, u.hour);
	}
	if (Math.round(minutes * 60) >= 3600) {
		const total = Math.round(minutes);
		return pair(Math.floor(total / 60), u.hour, total % 60, u.minute);
	}
	const totalSeconds = Math.round(minutes * 60);
	const m = Math.floor(totalSeconds / 60);
	return pair(m, u.minute, totalSeconds % 60, u.second);
}

/**
 * Formats a range of durations, with an en dash and no word, so that every
 * language reads it the same way and Gram reads it back: `45 min – 1 h`,
 * `1 h 30 min – 2 h`. When both sides are one term in the same unit, the
 * unit is written once: `1–2 h`. A range counts in days only when both
 * sides reach a day, so that both read in the same scale (`12–24 h`, not
 * `12 h – 1 d`). A non-breaking space before the dash keeps a line from
 * starting with it.
 */
export function formatDurationRange(
	min: number,
	max: number,
	lang?: string,
	options: DurationFormatOptions = {},
): string {
	const sameScale = {
		...options,
		days: options.days !== false && Math.round(min) >= MINUTES_PER_DAY,
	};
	const a = durationTerms(min, lang, sameScale);
	const b = durationTerms(max, lang, sameScale);
	const [ta] = a;
	const [tb] = b;
	if (a.length === 1 && b.length === 1 && ta && tb && ta.unit === tb.unit)
		return `${ta.value}–${tb.value}${NBSP}${tb.unit}`;
	return `${writeTerms(a)}${NBSP}– ${writeTerms(b)}`;
}

/**
 * A range written with a caller's duration format, which Gram cannot split
 * into terms: each end in full, joined as `formatDurationRange` joins two
 * different sides (`480 minutes – 960 minutes`).
 */
export function joinDurationRange(
	min: number,
	max: number,
	format: (minutes: number) => string,
): string {
	return `${format(min)}${NBSP}– ${format(max)}`;
}

/**
 * Displays a compiled timer the way Gram displays every time (`formatDuration`,
 * `formatDurationRange`), from its minutes. A timer is exact where a computed
 * time is not: past a day, one whose minutes the count in days would round
 * away stays in hours (`26 h 30 min`, not `1 d 3 h`). A refused timer has no
 * minutes: it keeps what the author wrote (`raw`). A timer compiled before
 * `minutes` existed falls back on its quantity and unit.
 *
 * `format` is the caller's duration format (the `formatDuration` option of a
 * render), so that its timers read like its other times; a range then gives
 * each end in full.
 */
export function formatTimerDuration(
	item: {
		raw?: string;
		quantity?: unknown;
		unit?: string | null;
		minutes?: number;
	},
	lang?: string,
	format?: (minutes: number) => string,
): string {
	if (typeof item.minutes !== "number" || !Number.isFinite(item.minutes)) {
		if (typeof item.raw === "string" && item.quantity === undefined)
			return item.raw.trim();
		const value = formatQuantityValue(item.quantity ?? "", lang);
		return item.unit ? `${value} ${item.unit}` : value;
	}
	const range = timerRangeMinutes(item);
	if (format)
		return range
			? joinDurationRange(range.min, range.max, format)
			: format(item.minutes);
	const sides = range ? [range.min, range.max] : [item.minutes];
	// Whole hours (or less than a day) lose nothing in the count in days.
	const exactInDays = sides.every(
		(m) => Math.round(m) < MINUTES_PER_DAY || Number.isInteger(m / 60),
	);
	const options = { days: exactInDays };
	return range
		? formatDurationRange(range.min, range.max, lang, options)
		: formatDuration(item.minutes, lang, options);
}

/** The two ends of a range timer, in minutes (its range is kept in `unit`). */
function timerRangeMinutes(item: {
	quantity?: unknown;
	unit?: string | null;
}): { min: number; max: number } | undefined {
	const q = item.quantity as
		| { type?: string; range?: { min?: unknown; max?: unknown } }
		| undefined;
	if (!q || typeof q !== "object" || q.type !== "range" || !q.range) return;
	const factor = TIME_TO_MINUTES[resolveTimeUnit(item.unit)];
	const { min, max } = q.range;
	if (!factor || typeof min !== "number" || typeof max !== "number") return;
	return { min: min * factor, max: max * factor };
}

/**
 * The duration formatter of a render: the one the options give, or the
 * default one in the options' language.
 */
export function durationFormatter(options: {
	formatDuration?: (minutes: number) => string;
	lang?: string;
}): (minutes: number) => string {
	return options.formatDuration ?? ((m) => formatDuration(m, options.lang));
}

/**
 * Displays a compiled timer token: its value followed by its unit. The unit
 * lives on the token (`{ type: "timer", quantity, unit }`), never on the
 * quantity. No unit means the value alone — there is no implicit "min".
 */
export function formatTimer(
	item: { quantity?: unknown; unit?: string | null },
	separator = "",
): string {
	const value = formatQuantityValue(item.quantity ?? "");
	return item.unit ? `${value}${separator}${item.unit}` : value;
}

/**
 * Safely escapes HTML special characters to prevent XSS.
 */
export function escapeHtml(unsafe: string | null | undefined): string {
	if (unsafe === undefined || unsafe === null) return "";
	return String(unsafe)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/**
 * Neutralizes raw HTML in Markdown output. Markdown renderers pass raw HTML
 * through by default (markdown-it, remark), so unescaped `<`/`&` in
 * user-authored recipe text (title, ingredient names, step content) can
 * survive as executable markup once the Markdown is rendered to HTML
 * downstream. Entities render back as literal characters in CommonMark, so
 * this is transparent for legitimate content.
 */
export function escapeMarkdownHtml(unsafe: string | null | undefined): string {
	if (unsafe === undefined || unsafe === null) return "";
	return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

/**
 * True for a shopping-list/cookware entry that's an alternative group
 * (`@a|@b`). Some older payloads use the `'group'` type instead of
 * `'alternative'` — both are accepted for backwards compatibility.
 */
export function isAlternativeGroup(item: { type?: string }): boolean {
	return item.type === "alternative" || item.type === "group";
}

/**
 * True for a composite ingredient entry (`<@parent`), which renders as a
 * parent line followed by its sub-usages.
 */
export function isCompositeItem(item: { type?: string }): boolean {
	return item.type === "composite";
}

/**
 * Groups consecutive shopping-list entries the analyzer couldn't merge into a
 * single mass (e.g. missing density between "100g" and "1 cup" of the same
 * ingredient) so a backend can render them as one clustered item instead of
 * scattered duplicate lines. Entries share `multiUnit: true` and a canonical
 * `id`. Items that aren't part of such a run (including alternative/composite
 * groups, which never carry `multiUnit`) each come back as their own
 * single-item group, unchanged. Shared here so all three backends apply the
 * same grouping.
 */
export function groupMultiUnitEntries<
	T extends { multiUnit?: boolean; id?: string },
>(items: T[]): T[][] {
	const groups: T[][] = [];
	for (const item of items) {
		const prevGroup = groups[groups.length - 1];
		const prevItem = prevGroup?.[0];
		if (
			prevGroup &&
			item.multiUnit &&
			prevItem?.multiUnit &&
			prevItem.id === item.id
		) {
			prevGroup.push(item);
		} else {
			groups.push([item]);
		}
	}
	return groups;
}

// Only bare strings ever occur as plain narrative text inside a processed
// step's `content` array — @gram-lang/kitchen's processText() never wraps
// text in a `{ type: 'text' }` object (that shape only exists for Timer/
// Temperature *quantities*, a different part of the tree).
/**
 * Drops all the whitespace written before a comment (`fouetter. // note`):
 * that space belongs to the syntax, not the sentence, and browsers always
 * allow a line break after a space — even before a word joiner — so a
 * footnote mark after it could start a line on its own.
 *
 * The whitespace can be spread over several text tokens: once a view has
 * taken a declaration out of the step (`fouetter. ->&pâte // note` leaves
 * `". "`, `" "`, comment), so this walks back from each comment through the
 * text tokens until it meets real content (a word, or an element). It only
 * ever removes whitespace, so it holds for any language and any content.
 * Call it on the tokens the view will actually join, after any filtering.
 */
export function trimBeforeComments(tokens: StepToken[]): StepToken[] {
	const out = [...tokens];
	for (let i = 0; i < out.length; i++) {
		const token = out[i];
		if (typeof token !== "object" || token?.type !== "comment") continue;
		for (let j = i - 1; j >= 0; j--) {
			const prev = out[j];
			if (typeof prev !== "string") break;
			const trimmed = prev.replace(/\s+$/u, "");
			out[j] = trimmed;
			if (trimmed !== "") break;
		}
	}
	return out;
}

function leadingChar(token: StepToken): string {
	return typeof token === "string" ? token.charAt(0) : "";
}

/**
 * Joins a step's tokens into a single string, inserting a space after an
 * element unless the next token is text starting with punctuation or
 * whitespace (so "flour," never becomes "flour ,") or a comment. The three formatters (HTML, print,
 * Markdown) share this exact spacing rule — only how each token is rendered
 * to a string, and which tokens are eligible for a trailing space, differ.
 */
export function joinStepTokens(
	tokens: StepToken[],
	renderToken: (token: StepToken) => string,
	isSpaceable: (token: StepToken) => boolean,
	glue?: (html: string) => string,
): string {
	const parts = tokens.map((token, i) => {
		let str = renderToken(token);
		if (isSpaceable(token)) {
			const next = tokens[i + 1];
			if (next !== undefined) {
				const nextChar = leadingChar(next);
				// The parser keeps no whitespace after an element, so two elements
				// in a row (`@flour{500 g} ~{1h}`) get their space here too. A
				// comment brings its own (or none, before a footnote mark).
				const nextIsElement =
					typeof next === "object" && next?.type !== "comment";
				if (nextIsElement || (nextChar && !/^[.,!?:;)\s]/.test(nextChar)))
					str += " ";
			}
		}
		return str;
	});
	if (!glue) return parts.join("");
	return glueElements(
		parts
			.map((str, i) => ({ str, element: typeof tokens[i] !== "string" }))
			.filter((p) => p.str !== ""),
		glue,
	);
}

/** The run of characters that sticks to its neighbour: up to the first space. */
const LEADING_RUN = /^\S*/u;
const TRAILING_RUN = /\S*$/u;

/**
 * An element of a step drawn as a box (a timer, a temperature: an inline
 * block for the browser) lets a line break right after or before it, even
 * against punctuation: the full stop of "for at least [30 min]." could start
 * a line on its own, and so could the "(" before "[30 min])". A word joiner
 * (U+2060) does not prevent it next to a box; `white-space: nowrap` does. So
 * each element written against a neighbour with no space between them is
 * wrapped, with what touches it (the punctuation, a footnote mark), by
 * `glue`: an element whose class sets it nowrap while its children wrap as
 * usual (`.gram-nobr`), so a long ingredient still breaks inside itself.
 */
function glueElements(
	items: { str: string; element: boolean }[],
	glue: (html: string) => string,
): string {
	// Whether nothing may break between item `i` and the next one.
	const glued = (i: number): boolean => {
		const a = items[i];
		const b = items[i + 1];
		if (!a || !b || !(a.element || b.element)) return false;
		return !/\s$/u.test(a.str) && !/^\s/u.test(b.str);
	};

	let out = "";
	let run = "";
	items.forEach((item, i) => {
		const withPrev = i > 0 && glued(i - 1);
		const withNext = glued(i);
		if (item.element) {
			if (!withPrev && !withNext) {
				out += item.str;
				return;
			}
			run += item.str;
			if (!withNext) {
				out += glue(run);
				run = "";
			}
			return;
		}
		let text = item.str;
		if (withPrev) {
			const head = text.match(LEADING_RUN)?.[0] ?? "";
			run += head;
			text = text.slice(head.length);
			// A word between two elements, touching both: one run.
			if (text === "" && withNext) return;
			out += glue(run);
			run = "";
		}
		if (withNext) {
			const tail = text.match(TRAILING_RUN)?.[0] ?? "";
			out += text.slice(0, text.length - tail.length);
			run = tail;
		} else {
			out += text;
		}
	});
	return out + run;
}

/** The `glue` of the HTML views: see `glueElements`. */
export function nobr(html: string): string {
	return `<span class="gram-nobr">${html}</span>`;
}

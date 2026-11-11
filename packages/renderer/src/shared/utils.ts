import { ASTNodeType } from "@gram-lang/parser";
import { round2 } from "@gram-lang/kitchen";
import type { AggregatedIngredient, StepToken } from "@gram-lang/kitchen";
import { isCoarseUnit } from "@gram-lang/i18n";

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

const COMMON_FRACTIONS = [
	{ val: 0.5, str: "1/2" },
	{ val: 0.25, str: "1/4" },
	{ val: 0.75, str: "3/4" },
	{ val: 1 / 3, str: "1/3" },
	{ val: 2 / 3, str: "2/3" },
	{ val: 0.125, str: "1/8" },
	{ val: 0.375, str: "3/8" },
	{ val: 0.625, str: "5/8" },
	{ val: 0.875, str: "7/8" },
];

/** "1/4" for a value strictly below 1 that is (nearly) a common fraction. */
export function toCommonFraction(value: number): string | undefined {
	if (value >= 1) return undefined;
	return COMMON_FRACTIONS.find((f) => Math.abs(value - f.val) < 0.01)?.str;
}

export function formatDecimalToFraction(value: unknown, unit?: string): string {
	if (typeof value !== "number") return String(value);

	// Exact integers
	if (Math.abs(value - Math.round(value)) < 0.01) {
		return String(Math.round(value));
	}

	const fraction = toCommonFraction(value);
	if (fraction) return fraction;

	if (unit && isCoarseUnit(unit)) {
		return String(round1(value));
	}

	return String(round2(value));
}

export interface ExtractedQuantity {
	value: number | string | null;
	text?: string;
	isRelative?: boolean;
}

export function getQty(
	item: Record<string, unknown>,
): ExtractedQuantity | undefined {
	if (item.qty !== undefined) {
		if (typeof item.qty === "number") {
			return {
				value: item.qty,
				text: formatDecimalToFraction(
					item.qty,
					item.unit as string | undefined,
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
		return item.qty as ExtractedQuantity;
	}
	if (item.quantity) return item.quantity as ExtractedQuantity;
	return undefined;
}

/**
 * Helper to display Timer/Temperature range or value.
 */
export function formatQuantityValue(q: any): string {
	if (!q) return "";
	if (q.type === "range" && q.text) return q.text;
	if (q.text) return q.text;
	if (q.type === ASTNodeType.RelativeQuantity) {
		return `${q.percent}% of ${q.target}`;
	}
	if (q.value !== undefined) return String(q.value);
	return String(q);
}

/**
 * Formats duration values into human readable strings (e.g. 90 -> 1h 30m).
 * Compiled timings are floats (20s is 0.333 min), so the value is rounded:
 * to the minute from one hour up, to the second below — never a raw decimal.
 */
export function formatDuration(minutes: number): string {
	if (!Number.isFinite(minutes) || minutes <= 0) return "0m";
	if (minutes >= 60) {
		const total = Math.round(minutes);
		const h = Math.floor(total / 60);
		const m = total % 60;
		return m > 0 ? `${h}h ${m}m` : `${h}h`;
	}
	const totalSeconds = Math.round(minutes * 60);
	const m = Math.floor(totalSeconds / 60);
	const s = totalSeconds % 60;
	if (m === 0) return `${s}s`;
	return s > 0 ? `${m}m ${s}s` : `${m}m`;
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
 * Joins a step's tokens into a single string, inserting a space between two
 * adjacent tokens unless the next one starts with punctuation or whitespace
 * (so "flour," never becomes "flour ,"). The three formatters (HTML, print,
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
				if (nextChar && !/^[.,!?:;)\s]/.test(nextChar)) str += " ";
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

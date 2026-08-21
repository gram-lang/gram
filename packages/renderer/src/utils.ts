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

export function formatDecimalToFraction(value: unknown, unit?: string): string {
	if (typeof value !== "number") return String(value);

	// Exact integers
	if (Math.abs(value - Math.round(value)) < 0.01) {
		return String(Math.round(value));
	}

	// Fractions only for values strictly below 1
	if (value < 1) {
		const commonFractions = [
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
		const match = commonFractions.find((f) => Math.abs(value - f.val) < 0.01);
		if (match) return match.str;
	}

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
 */
export function formatDuration(minutes: number): string {
	if (!minutes) return "0m";
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (h > 0) return `${h}h ${m > 0 ? `${m}m` : ""}`;
	return `${m}m`;
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
): string {
	return tokens
		.map((token, i) => {
			let str = renderToken(token);
			if (isSpaceable(token)) {
				const next = tokens[i + 1];
				if (next !== undefined) {
					const nextChar = leadingChar(next);
					if (nextChar && !/^[.,!?:;)\s]/.test(nextChar)) str += " ";
				}
			}
			return str;
		})
		.join("");
}

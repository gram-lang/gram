import { escapeHtml } from "./utils";

/** A line of a tooltip card: a label, its value, and why, under the value. */
export interface TooltipRow {
	label: string;
	value: string;
	detail?: string;
}

/**
 * The tooltip of an element of a step (an ingredient, an intermediate, a
 * piece of cookware): a title, aligned rows and small badges ("Optional").
 */
export interface TooltipCard {
	title: string;
	/**
	 * The title is not the word under the pointer (the "Alternatives" of an
	 * "(alt)" badge): the plain-text version keeps it.
	 */
	titleInText?: boolean;
	/** What the element is, under the title ("Intermediate ingredient"). */
	subtitle?: string;
	rows: TooltipRow[];
	badges?: string[];
}

/**
 * The attributes that carry a card: `data-tooltip`, a plain-text version the
 * CSS-only tooltip shows when no script runs (no title: it is the word under
 * the pointer), and `data-tooltip-html`, the card itself, which the floating
 * tooltip (`attachTooltips`) shows. An attribute, not a hidden child, so the
 * text of the step stays the text of the step (copy, screen readers).
 *
 * `colon` is the separator of the reader's language (" : " in French).
 * Empty when the card has nothing to say beyond its title.
 */
export function tooltipCardAttrs(card: TooltipCard, colon: string): string {
	const badges = card.badges ?? [];
	if (card.rows.length === 0 && badges.length === 0 && !card.subtitle) {
		return "";
	}

	const text = [
		...(card.titleInText ? [card.title] : []),
		...(card.subtitle ? [card.subtitle] : []),
		...card.rows.map(
			(r) =>
				`${r.label}${r.value ? `${colon}${r.value}` : ""}${r.detail ? ` (${r.detail})` : ""}`,
		),
		...badges,
	].join("\n");

	let html = `<div class="gram-tip">`;
	html += `<div class="gram-tip-head"><span class="gram-tip-title">${escapeHtml(card.title)}</span>`;
	for (const badge of badges) {
		html += `<span class="gram-tip-badge">${escapeHtml(badge)}</span>`;
	}
	html += `</div>`;
	if (card.subtitle) {
		html += `<div class="gram-tip-subtitle">${escapeHtml(card.subtitle)}</div>`;
	}
	if (card.rows.length > 0) {
		html += `<dl class="gram-tip-rows">`;
		for (const row of card.rows) {
			html += `<dt>${escapeHtml(row.label)}</dt><dd><span class="gram-tip-value">${escapeHtml(row.value)}</span>`;
			if (row.detail) {
				html += `<span class="gram-tip-detail">${escapeHtml(row.detail)}</span>`;
			}
			html += `</dd>`;
		}
		html += `</dl>`;
	}
	html += `</div>`;

	return ` data-tooltip="${escapeHtml(text)}" data-tooltip-html="${escapeHtml(html)}"`;
}

/**
 * The same HTML without its tooltips, for a page that cannot show them: a
 * printed recipe, a run sheet. Values are escaped, so no `"` ends one early.
 */
export function stripTooltips(html: string): string {
	return html.replace(/ data-tooltip(?:-html)?="[^"]*"/g, "");
}

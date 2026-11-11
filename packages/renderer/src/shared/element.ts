import type { RenderContext, TextStyle } from "../types";
import {
	escapeHtml,
	escapeMarkdownHtml,
	getQty,
	formatQuantityValue,
	formatDecimalToFraction,
	round1,
} from "./utils";
import { getDictionary, normalizeUnit } from "@gram-lang/i18n";

import { DEFAULT_ICONS } from "./icons";
import { type TooltipRow, tooltipCardAttrs } from "./tooltip-card";

export { DEFAULT_ICONS };

/**
 * What `formatElement` writes: HTML, Markdown, or plain text (the `text`
 * format, for a terminal or a plain file: no markup, no escaping, no icons).
 */
export type ElementFormat = "html" | "md" | "text";

/** A piece of plain text, set apart as the surface asked (`TextStyle`). */
function styled(
	context: RenderContext,
	kind: keyof TextStyle,
	text: string,
): string {
	return context.textStyle?.[kind]?.(text) ?? text;
}

/**
 * A name and its quantity in the `text` format: in a column when the list asks
 * for one (`textColumn`, the name padded to it), between parentheses in a
 * sentence (`flour (200 g)`). The name is measured before it is styled.
 */
function textRow(
	context: RenderContext,
	name: string,
	styledName: string,
	detail: string,
): string {
	if (!detail) return styledName;
	if (context.textColumn === undefined) return `${styledName} (${detail})`;
	const gap = " ".repeat(Math.max(1, context.textColumn - name.length + 1));
	return `${styledName}${gap}${detail}`;
}

/** How an estimated mass was obtained, in the reader's words. */
function massMethodLabel(
	conversionMethod: string,
	t: ReturnType<typeof getDictionary>,
): string | undefined {
	if (conversionMethod === "density") return t.renderer.massMethodDensity;
	if (conversionMethod === "unit_weight")
		return t.renderer.massMethodUnitWeight;
	return undefined;
}

/** A quantity as written: "2 tbsp", "1/2 tsp", "6". Empty without one. */
function writtenQty(item: any): string {
	const qty = getQty(item);
	if (!qty) return "";
	const value = qty.text || formatDecimalToFraction(qty.value, item.unit);
	return `${value}${item.unit ? ` ${item.unit}` : ""}`;
}

/**
 * The tooltip of an ingredient in a step. What the text of the step already
 * says is not repeated: the quantity and its mass only when the step hides
 * them (`hideIngredientQty`), except an estimated mass, whose "~" the
 * tooltip explains (converted with an average density...).
 */
function ingredientTooltip(
	item: any,
	context: RenderContext,
	f: {
		name: string;
		originalQtyStr: string;
		normalizedMass: number | null;
		isEstimate: boolean;
		conversionMethod: string;
		massAddsInfo: boolean;
		prep: string;
		isOptional: boolean;
	},
): string {
	const t = getDictionary(context.lang);
	const hidden = !!context.hideIngredientQty;
	const rows: TooltipRow[] = [];

	if (hidden) {
		if (item.bakersPercentage !== undefined) {
			rows.push({
				label: t.renderer.tooltipBakers,
				value: `${item.bakersPercentage}%`,
			});
			const absolute =
				f.originalQtyStr ||
				(f.normalizedMass !== null ? `${f.normalizedMass} g` : "");
			if (!context.bakersMathOnly && absolute) {
				rows.push({ label: t.renderer.quantity, value: absolute });
			}
		} else if (f.originalQtyStr) {
			rows.push({ label: t.renderer.quantity, value: f.originalQtyStr });
		}
	}

	if (f.massAddsInfo && f.normalizedMass !== null && (hidden || f.isEstimate)) {
		rows.push({
			label: t.renderer.tooltipMass,
			value: `${f.isEstimate ? "~" : ""}${f.normalizedMass} g`,
			detail: f.isEstimate ? massMethodLabel(f.conversionMethod, t) : undefined,
		});
	}

	if (f.prep) {
		rows.push({ label: t.renderer.tooltipPreparation, value: f.prep });
	}

	// A part of a composite (the yolks of the eggs): what it is taken from.
	const composite = item.composite;
	if (composite?.parent) {
		const parentName =
			context.registry?.ingredients?.[composite.parent]?.name ||
			composite.parent;
		const parentQty =
			composite.quantity !== undefined && composite.quantity !== null
				? `${composite.quantity}${composite.unit ? ` ${composite.unit}` : ""} `
				: "";
		rows.push({
			label: t.renderer.tooltipTakenFrom,
			value: `${parentQty}${parentName}`,
		});
	}

	return tooltipCardAttrs(
		{
			title: f.name,
			rows,
			badges: f.isOptional ? [t.renderer.optional] : [],
		},
		t.renderer.colon,
	);
}

const strategies: Record<
	string,
	(item: any, format: ElementFormat, context: RenderContext) => string
> = {
	ingredient: (item, format, context) => {
		const t = getDictionary(context.lang);
		const registry = context.registry || {};
		const ingredients = registry.ingredients || {};
		const def = ingredients[item.id];

		// The recipe's own declared name (preserved through shopping-list
		// aggregation even when `.id` gets rewritten to a canonical id) always
		// wins over a registry lookup — the registry is keyed by the recipe's
		// original ids and misses once `.id` becomes canonical, which used to
		// silently fall back to that canonical (often English) id.
		const baseName =
			item.name || def?.name || item.id || t.renderer.unknownIngredient;
		const name = item.alias || baseName;

		// item.parent/item.parentPreparation are only ever populated by the
		// section/mise-en-place aggregation pipeline (never the shopping list or
		// inline step text), so gating on their presence is inherently scoped to
		// that context. parentPreparation describes the PARENT (e.g. "cut in
		// half"), distinct from item.preparation which describes this ingredient
		// itself — the two are folded into one parenthetical for display.
		let parentSuffixMd = "";
		let parentSuffixHtml = "";
		let parentDataAttr = "";
		if (item.parent) {
			const parentLabel = item.parentPreparation
				? `${item.parent}, ${item.parentPreparation}`
				: item.parent;
			const parentClass =
				context.classes?.compositeParentText || "composite-parent";
			parentSuffixMd = ` (${parentLabel})`;
			parentSuffixHtml = ` <span class="${parentClass}">(${escapeHtml(parentLabel)})</span>`;
			parentDataAttr = ` data-parent="${escapeHtml(item.parent)}"`;
			if (item.parentPreparation) {
				parentDataAttr += ` data-parent-preparation="${escapeHtml(item.parentPreparation)}"`;
			}
		}

		const qty = getQty(item);

		const prep = item.preparation || "";
		const isOptional = item.modifiers?.includes("optional");

		let normalizedMass = null;
		let isEstimate = false;
		let conversionMethod = "";
		if (item.normalizedMass) {
			normalizedMass = round1(item.normalizedMass);
			isEstimate = !!item.isEstimate;
			conversionMethod = item.conversionMethod || "";
		}

		let plainQty = "";
		let originalQtyStr = "";
		if (qty) {
			originalQtyStr =
				(qty.text || formatDecimalToFraction(qty.value, item.unit)) +
				(item.unit ? ` ${item.unit}` : "");
		}

		if (item.bakersPercentage !== undefined) {
			const perc = `${item.bakersPercentage}%`;
			let absMass = "";
			if (normalizedMass !== null) absMass = `${normalizedMass}g`;
			else absMass = originalQtyStr;
			plainQty = context.bakersMathOnly ? perc : `${perc} (${absMass})`;
		} else {
			plainQty = originalQtyStr;
		}

		if (
			item.variable_entries &&
			item.variable_entries.length > 0 &&
			item.bakersPercentage === undefined
		) {
			plainQty = plainQty
				? `${plainQty} + ${item.variable_entries.join(" + ")}`
				: item.variable_entries.join(" + ");
			if (originalQtyStr)
				originalQtyStr = `${originalQtyStr} + ${item.variable_entries.join(" + ")}`;
			else originalQtyStr = item.variable_entries.join(" + ");
		}

		// The standardized mass, next to the quantity as written, wherever it
		// tells something the written quantity doesn't: not for a quantity
		// already in grams, nor for a relative one (its mass is derived), nor
		// with baker's percentages (`plainQty` already carries the mass).
		const massAddsInfo =
			normalizedMass !== null &&
			conversionMethod !== "relative" &&
			normalizeUnit(item.unit, context.lang) !== "g";
		const massText =
			massAddsInfo && item.bakersPercentage === undefined
				? `${isEstimate ? (format === "text" ? "≈" : "~") : ""}${normalizedMass} g`
				: "";
		// The quantity written in a sentence or a Markdown list: as written,
		// then the mass when it adds something (`250 ml, ~147.5 g`).
		const textQty = [plainQty, massText].filter(Boolean).join(", ");

		let htmlQty = plainQty;
		let htmlBakersBadge = "";

		if (format === "html" && item.bakersPercentage !== undefined) {
			const perc = `${item.bakersPercentage}%`;
			if (context.bakersMathOnly) {
				htmlQty = perc;
			} else {
				htmlQty =
					originalQtyStr ||
					(normalizedMass !== null ? `${normalizedMass}g` : "");
				const bpClass = context.classes?.bakersBadge || "bakers-badge";
				htmlBakersBadge = ` <span class="${bpClass}" data-tooltip="${escapeHtml(t.renderer.bakersPercentage)}">${perc}</span>`;
			}
		}

		if (format === "html") {
			const baseClass = item.type === "reference" ? "reference" : "ingredient";
			const className =
				item.type === "reference"
					? context.classes?.reference || baseClass
					: context.classes?.ingredient || baseClass;

			const mode = context.formatMode || "inline";

			if (mode === "inline") {
				let html = `<span class="${className}" data-name="${escapeHtml(baseName)}"${parentDataAttr}`;
				html += ingredientTooltip(item, context, {
					name,
					originalQtyStr,
					normalizedMass,
					isEstimate,
					conversionMethod,
					massAddsInfo,
					prep,
					isOptional: !!isOptional,
				});
				html += `>${escapeHtml(name)}${parentSuffixHtml}`;
				// Written in the text of the step, as in Markdown, so it is there
				// on paper too; the tooltip keeps the details.
				if (!context.hideIngredientQty && textQty) {
					const qtyClass = context.classes?.stepQuantity || "step-quantity";
					html += ` <span class="${qtyClass}">(${escapeHtml(textQty)})</span>`;
				}
				html += `</span>`;
				return html;
			} else {
				let html = `<span class="${className}" data-name="${escapeHtml(baseName)}"${parentDataAttr}>${escapeHtml(name)}${parentSuffixHtml}`;

				if (!context.hideIngredientQty && htmlQty) {
					html += ` <span class="quantity">${escapeHtml(htmlQty)}</span>`;
				}

				if (htmlBakersBadge) {
					html += htmlBakersBadge;
				}

				if (massAddsInfo) {
					let display = `${normalizedMass}g`;
					if (isEstimate) display = `~${display}`;
					const badgeClass = context.classes?.massBadge || "mass-badge";
					html += ` <span class="${badgeClass}" data-tooltip="${escapeHtml(t.renderer.standardizedMass)}: ${normalizedMass}g">${display}</span>`;
				}

				if (prep && mode !== "shopping-list") {
					const prepClass = context.classes?.prepText || "prep";
					if (mode === "mise-en-place") {
						html += ` <span class="${prepClass}">&mdash; ${escapeHtml(prep)}</span>`;
					} else {
						html += ` <span class="${prepClass}">(${escapeHtml(prep)})</span>`;
					}
				}
				if (isOptional) {
					const optClass = context.classes?.optionalText || "opt";
					html += ` <span class="${optClass}">(${t.renderer.optional.toLocaleLowerCase(context.lang || "en")})</span>`;
				}
				html += `</span>`;
				return html;
			}
		} else if (format === "text") {
			const mode = context.formatMode || "inline";
			const label = name + parentSuffixMd;
			const styledLabel = styled(
				context,
				item.type === "reference" ? "reference" : "ingredient",
				name,
			);
			const qtyText = !context.hideIngredientQty ? textQty : "";
			const extras: string[] = [];
			if (prep && mode !== "shopping-list") {
				extras.push(mode === "mise-en-place" ? `— ${prep}` : `(${prep})`);
			}
			if (isOptional) {
				extras.push(
					`(${t.renderer.optional.toLocaleLowerCase(context.lang || "en")})`,
				);
			}
			return [
				textRow(
					mode === "inline" ? { ...context, textColumn: undefined } : context,
					label,
					styledLabel + parentSuffixMd,
					qtyText,
				),
				...extras,
			].join(" ");
		} else {
			const mdName = escapeMarkdownHtml(name);
			let md = item.type === "reference" ? `👉*${mdName}*` : `**${mdName}**`;
			md += escapeMarkdownHtml(parentSuffixMd);
			// plainQty already folds in bakersPercentage/bakersMathOnly and variable_entries,
			// same as the HTML branch above.
			if (!context.hideIngredientQty && textQty) {
				md += ` (${escapeMarkdownHtml(textQty)})`;
			}
			const mode = context.formatMode || "inline";
			if (prep && mode !== "shopping-list") {
				const mdPrep = escapeMarkdownHtml(prep);
				if (mode === "mise-en-place") md += ` — ${mdPrep}`;
				else md += ` (${mdPrep})`;
			}
			if (isOptional)
				md += ` (${t.renderer.optional.toLocaleLowerCase(context.lang || "en")})`;
			return md;
		}
	},

	cookware: (item, format, context) => {
		const t = getDictionary(context.lang);
		const registry = context.registry || {};
		const cookwareList = registry.cookware || {};
		const def = cookwareList[item.id];
		const baseName = def ? def.name : item.id || t.renderer.unknownCookware;
		const name = item.alias || baseName;
		const qty = getQty(item);
		const qtyVal = qty ? qty.value : null;

		if (format === "html") {
			const className = context.classes?.cookware || "cookware";
			const mode = context.formatMode || "inline";

			if (mode === "inline") {
				let html = `<span class="${className}" data-name="${escapeHtml(baseName)}"`;
				// "×2", as in the list of cookware, and nothing for one: needing
				// a pan already means having one.
				if (qtyVal !== null && String(qtyVal) !== "1") {
					html += tooltipCardAttrs(
						{
							title: name,
							rows: [{ label: t.renderer.quantity, value: `×${qtyVal}` }],
						},
						t.renderer.colon,
					);
				}
				html += `>${escapeHtml(name)}</span>`;
				return html;
			} else {
				let html = `<span class="${className}" data-name="${escapeHtml(baseName)}">${escapeHtml(name)}`;
				if (qtyVal !== null)
					html += ` <span class="quantity">${escapeHtml(String(qtyVal))}</span>`;
				html += `</span>`;
				return html;
			}
		} else if (format === "text") {
			const detail = qtyVal !== null ? String(qtyVal) : "";
			const mode = context.formatMode || "inline";
			return textRow(
				mode === "inline" ? { ...context, textColumn: undefined } : context,
				name,
				styled(context, "cookware", name),
				detail,
			);
		} else {
			let md = `*${escapeMarkdownHtml(name)}*`;
			if (qtyVal !== null) md += ` (${qtyVal})`;
			return md;
		}
	},

	timer: (item, format, context) => {
		const q = item.quantity || { value: "" };
		const qVal = formatQuantityValue(q);
		// item.quantity can be a bare string (a rejected/free-text timer
		// value — see processor.ts's INVALID_UNIT handling for TextQuantity),
		// which has no `.value` of its own; the string itself *is* the value.
		const dataValue = typeof q === "string" ? q : q.value;
		const unitStr = item.unit ? ` ${item.unit}` : "";
		const isPassive = !!item.isPassive;

		if (format === "html") {
			const t = getDictionary(context.lang);
			const passiveClassStr = isPassive ? " passive" : "";
			const className = (context.classes?.timer || "timer") + passiveClassStr;
			const iconKey = isPassive ? "hourglass" : "timer";
			const icon = context.icons?.[iconKey] ?? DEFAULT_ICONS.html[iconKey];
			const tooltipStr = isPassive
				? t.renderer.passiveTimeTooltip
				: t.renderer.activeTimeTooltip;
			return `<span class="${className}" data-tooltip="${tooltipStr}" data-value="${escapeHtml(dataValue)}" data-unit="${escapeHtml(item.unit || "")}">${icon} <span class="timer-text">${escapeHtml(qVal)}${escapeHtml(unitStr)}</span></span>`;
		} else if (format === "text") {
			return styled(context, "timer", `${qVal}${unitStr}`);
		} else {
			const prefix =
				context.icons?.hourglass !== undefined
					? isPassive
						? context.icons.hourglass
						: (context.icons.timer ?? "")
					: isPassive
						? DEFAULT_ICONS.md.hourglass
						: DEFAULT_ICONS.md.timer;
			const suffix = isPassive
				? ` (${getDictionary(context.lang).renderer.passive})`
				: "";
			return `${prefix}${escapeMarkdownHtml(qVal)}${escapeMarkdownHtml(unitStr)}${suffix}`;
		}
	},

	temperature: (item, format, context) => {
		const termIcon =
			context.icons?.thermometer ??
			(format === "html"
				? DEFAULT_ICONS.html.thermometer
				: DEFAULT_ICONS.md.thermometer);
		const className = context.classes?.temperature || "temp";
		if (format === "text") {
			const value = item.text
				? String(item.text)
				: `${formatQuantityValue(item.quantity || { value: "" })}${item.unit ? ` ${item.unit}` : ""}`;
			return styled(context, "timer", value);
		}
		if (item.text) {
			const textVal = item.text;
			if (format === "html") {
				return `<span class="${className}" data-semantic="${escapeHtml(textVal)}">${termIcon} ${escapeHtml(textVal)}</span>`;
			} else {
				return `${termIcon}${escapeMarkdownHtml(textVal)}`;
			}
		} else {
			const q = item.quantity || { value: "" };
			const qVal = formatQuantityValue(q);
			const unitStr = item.unit ? ` ${item.unit}` : "";
			if (format === "html") {
				return `<span class="${className}" data-value="${escapeHtml(q.value)}" data-unit="${escapeHtml(item.unit || "")}">${termIcon} ${escapeHtml(qVal)}${escapeHtml(unitStr)}</span>`;
			} else {
				return `${termIcon}${escapeMarkdownHtml(qVal)}${escapeMarkdownHtml(unitStr)}`;
			}
		}
	},

	reference: (item, format, context) => {
		const t = getDictionary(context.lang);
		const registry = context.registry || {};
		const ingredients = registry.ingredients || {};
		const def = ingredients[item.id];
		const name = def ? def.name : item.id || t.renderer.unknownReference;
		const qty = getQty(item);

		if (format === "html") {
			const caretIcon =
				context.icons?.caretRight ?? DEFAULT_ICONS.html.caretRight;
			const className = context.classes?.reference || "reference";
			const mode = context.formatMode || "inline";
			const refId = item.id || item.name;
			const refAttr = refId ? ` data-ref-id="${escapeHtml(refId)}"` : "";

			if (mode === "inline") {
				const qtyParts = qty
					? [writtenQty(item), ...(item.variable_entries ?? [])]
					: [];
				const tip = tooltipCardAttrs(
					{
						title: name,
						subtitle: t.renderer.intermediateIngredient,
						rows:
							qtyParts.length > 0
								? [{ label: t.renderer.quantity, value: qtyParts.join(" + ") }]
								: [],
					},
					t.renderer.colon,
				);
				return `<span class="${className}"${refAttr}${tip}>${caretIcon} ${escapeHtml(name)}</span>`;
			} else {
				let html = `<span class="${className}"${refAttr}>${caretIcon} ${escapeHtml(name)}`;
				if (qty) {
					const parts = [];
					const baseQty =
						qty.text || formatDecimalToFraction(qty.value, item.unit);
					let first = escapeHtml(baseQty);
					if (item.unit)
						first += ` <span class="unit">${escapeHtml(item.unit)}</span>`;
					parts.push(first);
					if (item.variable_entries && item.variable_entries.length > 0) {
						parts.push(...item.variable_entries.map(escapeHtml));
					}
					html += ` <span class="quantity">${parts.join(" + ")}</span>`;
				}
				html += `</span>`;
				return html;
			}
		} else if (format === "text") {
			let detail = "";
			if (qty) {
				const parts = [
					`${qty.text || formatDecimalToFraction(qty.value, item.unit)}${item.unit ? ` ${item.unit}` : ""}`,
					...(item.variable_entries ?? []),
				];
				detail = parts.join(" + ");
			}
			const mode = context.formatMode || "inline";
			return textRow(
				mode === "inline" ? { ...context, textColumn: undefined } : context,
				name,
				styled(context, "reference", name),
				detail,
			);
		} else {
			let md = `👉*${escapeMarkdownHtml(name)}*`;
			if (qty) {
				const parts = [];
				const qtyVal =
					qty.text || formatDecimalToFraction(qty.value, item.unit);
				let first = String(qtyVal);
				if (item.unit) first += ` ${item.unit}`;
				parts.push(first);
				if (item.variable_entries && item.variable_entries.length > 0) {
					parts.push(...item.variable_entries);
				}
				md += ` (${escapeMarkdownHtml(parts.join(" + "))})`;
			}
			return md;
		}
	},

	declaration: (item, format, context) => {
		const name =
			(item.id && context.registry?.ingredients?.[item.id]?.name) ||
			item.name ||
			"";
		if (format === "html") {
			const arrowIcon =
				context.icons?.arrowRight ?? DEFAULT_ICONS.html.arrowRight;
			const className = `${context.classes?.declaration || "declaration"} declaration-badge declaration-block`;
			const declId = item.id || item.name;
			const declAttr = declId ? ` data-declares="${escapeHtml(declId)}"` : "";
			// The word joiner (U+2060) keeps the badge on the line of the word
			// before it: a line can't start with a lone "→ dough".
			return `&#8288;<span class="${className}"${declAttr}>${arrowIcon} ${escapeHtml(name)}</span>`;
		} else if (format === "text") {
			return `→ ${styled(context, "reference", name)}`;
		} else {
			const prefix = context.icons?.arrowRight ?? DEFAULT_ICONS.md.arrowRight;
			return `${prefix}${escapeMarkdownHtml(name)}`;
		}
	},

	comment: (item, format, context) => {
		const text = (item.value || "").trim();
		// Footnote collection is format-agnostic: any backend that initializes
		// `context._inlineComments` (see each backend's buildContext) gets footnotes
		// instead of inline comments, regardless of html/md. Only the reference
		// syntax differs between the two formats.
		if (context._inlineComments) {
			context._inlineComments.push(text);
			const index = context._inlineComments.length;
			const renderId = context._renderId || "note";
			if (format === "text") return styled(context, "dim", `[${index}]`);
			if (format === "html") {
				// The word joiner (U+2060) keeps "[1]" on the line of the word
				// it annotates, even after a space: a line never starts with it.
				return `&#8288;<sup class="footnote-ref"><a href="#${renderId}-${index}" id="ref-${renderId}-${index}">[${index}]</a></sup>`;
			}
			// GFM-style footnote reference; the definition itself is emitted at the
			// bottom of the document by the backend's renderFootnotes hook, once
			// every step has been rendered.
			return `[^${renderId}-${index}]`;
		}
		if (format === "html") {
			return `<span class="inline-comment">${escapeHtml(text)}</span>`;
		}
		if (format === "text") return styled(context, "dim", `(${text})`);
		return ` *${escapeMarkdownHtml(text)}*`;
	},

	alternative: (item, format, context) => {
		const t = getDictionary(context.lang);
		const registry = context.registry || {};
		const cookwareList = registry.cookware || {};

		if (format === "html") {
			const mode = context.formatMode || "inline";
			if (mode === "inline") {
				const firstOpt = item.options[0];
				const isCookware =
					firstOpt.type === "cookware" || !!cookwareList[firstOpt.id];
				const resolvedOpt = {
					...firstOpt,
					type: firstOpt.type || (isCookware ? "cookware" : "ingredient"),
				};

				// One row per other option, with its own quantity and preparation:
				// a substitute is rarely used in the same amount.
				const altRows: TooltipRow[] = item.options.slice(1).map((opt: any) => ({
					label: String(
						opt.alias ||
							opt.name ||
							opt.display ||
							registry.ingredients?.[opt.id]?.name ||
							cookwareList[opt.id]?.name ||
							opt.id ||
							"",
					),
					value: writtenQty(opt),
					detail: opt.preparation || undefined,
				}));

				let html = formatElement(resolvedOpt, format, context);
				const tip = tooltipCardAttrs(
					{ title: t.renderer.alternatives, titleInText: true, rows: altRows },
					t.renderer.colon,
				);
				html += ` <span class="ingredient-alt-badge"${tip}>(${escapeHtml(t.renderer.alt)})</span>`;
				return html;
			} else {
				const separator = ` <span class="keyword">${escapeHtml(t.renderer.or)}</span> `;
				const joined = item.options
					.map((opt: any) => {
						const isCookware =
							opt.type === "cookware" || !!cookwareList[opt.id];
						const resolvedOpt = {
							...opt,
							type: opt.type || (isCookware ? "cookware" : "ingredient"),
						};
						return formatElement(resolvedOpt, format, context);
					})
					.join(separator);
				// Shopping-list/section-list <li> elements use a "flex row,
				// justify-content: space-between" layout that expects a single
				// child. A leaf ingredient/cookware item is naturally one <span>,
				// but joining several options produces multiple sibling <span>s —
				// wrap them in one container so the group still counts as a
				// single flex child.
				const groupClass = context.classes?.alternativeGroup || "alt-group";
				return `<span class="${groupClass}">${joined}</span>`;
			}
		} else {
			// Plain text says "or" in the reader's language; Markdown keeps its word.
			const separator = ` ${t.renderer.or} `;
			// The options of a list row share one line: no column between them.
			const optionContext =
				format === "text" ? { ...context, textColumn: undefined } : context;
			return item.options
				.map((opt: any) => {
					const isCookware = opt.type === "cookware" || !!cookwareList[opt.id];
					const resolvedOpt = {
						...opt,
						type: opt.type || (isCookware ? "cookware" : "ingredient"),
					};
					return formatElement(resolvedOpt, format, optionContext);
				})
				.join(separator);
		}
	},

	// "group" AST nodes render identically to "alternative" ones.
	group: (item, format, context) => {
		return strategies.alternative!(item, format, context);
	},

	// A composite item in the shopping list is a parent ingredient; reuse the
	// ingredient formatter rather than duplicating its display logic.
	composite: (item, format, context) => {
		return strategies.ingredient!(
			{ ...item, type: "ingredient" },
			format,
			context,
		);
	},

	text: (item, format) => {
		const text = item.value || "";
		if (format === "text") return text;
		return format === "html" ? escapeHtml(text) : escapeMarkdownHtml(text);
	},
};

/**
 * Entry point to format an AST element as HTML, Markdown or plain text.
 *
 * `element` is typed `unknown` rather than a union because call sites pass
 * genuinely heterogeneous shapes (a `Usage`, a `StepToken`, an aggregated
 * shopping-list record, an ad-hoc alternative/composite group) with no
 * common index signature. The strategy table's `.type`-keyed dispatch below
 * is not a real discriminated union — that would require reworking
 * `Usage.type` across the kitchen package.
 */
export function formatElement(
	element: unknown,
	format: ElementFormat,
	context: RenderContext = {},
): string {
	if (element === null || element === undefined) return "";
	if (typeof element === "string") {
		if (format === "text") return element;
		return format === "html"
			? escapeHtml(element)
			: escapeMarkdownHtml(element);
	}

	const el = element as Record<string, unknown>;

	const type = (el.type as string) || "";

	// Untyped elements with an id are implicit ingredient/cookware references;
	// infer which from the registry.
	if (!type && el.id) {
		const registry = context.registry || {};
		const id = el.id as string;
		const isCookware = !!registry.cookware?.[id];
		const inferredType = isCookware ? "cookware" : "ingredient";
		return strategies[inferredType]!(
			{ ...el, type: inferredType },
			format,
			context,
		);
	}

	const strategy = strategies[type];
	if (strategy) {
		return strategy(el, format, context);
	}

	if (format === "text") return String(el.value || "");
	return format === "html"
		? escapeHtml(String(el.value || ""))
		: escapeMarkdownHtml(String(el.value || ""));
}

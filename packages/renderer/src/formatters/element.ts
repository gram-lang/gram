import type { RenderContext } from "../types";
import {
	escapeHtml,
	escapeMarkdownHtml,
	getQty,
	formatQuantityValue,
	formatDecimalToFraction,
	round1,
} from "../utils";
import { getDictionary } from "@gram-lang/i18n";

export const DEFAULT_ICONS = {
	html: {
		hourglass: '<i class="ph ph-hourglass"></i>',
		timer: '<i class="ph ph-timer"></i>',
		thermometer: '<i class="ph ph-thermometer"></i>',
		caretRight: '<i class="ph ph-caret-circle-right"></i>',
		arrowRight: '<i class="ph ph-arrow-right"></i>',
		arrowUDownLeft: '<i class="ph ph-arrow-u-down-left"></i>',
		warning: '<i class="ph ph-warning"></i>',
		pencilSimple: '<i class="ph ph-pencil-simple"></i>',
		minus: '<i class="ph ph-minus"></i>',
		plus: '<i class="ph ph-plus"></i>',
	},
	md: {
		hourglass: "⏳ ",
		timer: "⏲️ ",
		thermometer: "🔥",
		caretRight: "👉",
		arrowRight: "->&",
		arrowUDownLeft: "",
		warning: " ⚠️",
		pencilSimple: "",
		minus: "-",
		plus: "+",
	},
};

const strategies: Record<
	string,
	(item: any, format: "html" | "md", context: RenderContext) => string
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
			item.name || def?.name || item.id || "[Unknown Ingredient]";
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
				const tooltipLines = [];
				if (plainQty) tooltipLines.push(`${plainQty}`);

				if (
					item.bakersPercentage === undefined &&
					normalizedMass !== null &&
					conversionMethod !== "relative"
				) {
					let massDisplay = `${normalizedMass}g`;
					if (isEstimate) massDisplay = `~${massDisplay}`;
					tooltipLines.push(`(${t.renderer.standardized}: ${massDisplay})`);
				}

				if (prep) tooltipLines.push(`— ${prep}`);
				if (isOptional) tooltipLines.push(`(${t.renderer.optional})`);

				let html = `<span class="${className}" data-name="${escapeHtml(baseName)}"${parentDataAttr}`;
				if (tooltipLines.length > 0) {
					html += ` data-tooltip="${escapeHtml(tooltipLines.join("\n"))}"`;
				}
				html += `>${escapeHtml(name)}${parentSuffixHtml}`;
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

				if (normalizedMass !== null && conversionMethod !== "relative") {
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
					html += ` <span class="${optClass}">(optional)</span>`;
				}
				html += `</span>`;
				return html;
			}
		} else {
			const mdName = escapeMarkdownHtml(name);
			let md = item.type === "reference" ? `👉*${mdName}*` : `**${mdName}**`;
			md += escapeMarkdownHtml(parentSuffixMd);
			// plainQty already folds in bakersPercentage/bakersMathOnly and variable_entries,
			// same as the HTML branch above.
			if (!context.hideIngredientQty && plainQty) {
				md += ` (${escapeMarkdownHtml(plainQty)})`;
			}
			const mode = context.formatMode || "inline";
			if (prep && mode !== "shopping-list") {
				const mdPrep = escapeMarkdownHtml(prep);
				if (mode === "mise-en-place") md += ` — ${mdPrep}`;
				else md += ` (${mdPrep})`;
			}
			if (isOptional) md += " (optional)";
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
				if (qtyVal !== null)
					html += ` data-tooltip="${escapeHtml(t.renderer.quantity)}: ${escapeHtml(String(qtyVal))}"`;
				html += `>${escapeHtml(name)}</span>`;
				return html;
			} else {
				let html = `<span class="${className}" data-name="${escapeHtml(baseName)}">${escapeHtml(name)}`;
				if (qtyVal !== null)
					html += ` <span class="quantity">${escapeHtml(String(qtyVal))}</span>`;
				html += `</span>`;
				return html;
			}
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
		} else {
			const prefix =
				context.icons?.hourglass !== undefined
					? isPassive
						? context.icons.hourglass
						: (context.icons.timer ?? "")
					: isPassive
						? DEFAULT_ICONS.md.hourglass
						: DEFAULT_ICONS.md.timer;
			const suffix = isPassive ? " (passive)" : "";
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
		const name = def ? def.name : item.id || "[Unknown Reference]";
		const qty = getQty(item);

		if (format === "html") {
			const caretIcon =
				context.icons?.caretRight ?? DEFAULT_ICONS.html.caretRight;
			const className = context.classes?.reference || "reference";
			const mode = context.formatMode || "inline";

			if (mode === "inline") {
				let tooltipText = t.renderer.intermediateIngredient;
				if (qty) {
					const parts = [];
					const baseQty =
						qty.text || formatDecimalToFraction(qty.value, item.unit);
					parts.push(baseQty + (item.unit ? ` ${item.unit}` : ""));
					if (item.variable_entries && item.variable_entries.length > 0) {
						parts.push(...item.variable_entries);
					}
					tooltipText += `\n${t.renderer.quantity}: ${parts.join(" + ")}`;
				}
				return `<span class="${className}" data-tooltip="${escapeHtml(tooltipText)}">${caretIcon} ${escapeHtml(name)}</span>`;
			} else {
				let html = `<span class="${className}">${caretIcon} ${escapeHtml(name)}`;
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
		const name = item.name || "";
		if (format === "html") {
			const arrowIcon =
				context.icons?.arrowElbowDownRight ??
				'<i class="ph ph-arrow-elbow-down-right"></i>';
			const className = `${context.classes?.declaration || "declaration"} declaration-block`;
			return `<span class="${className}">${arrowIcon} ${escapeHtml(name)}</span>`;
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
			if (format === "html") {
				return `<sup class="footnote-ref"><a href="#${renderId}-${index}" id="ref-${renderId}-${index}">[${index}]</a></sup>`;
			}
			// GFM-style footnote reference; the definition itself is emitted at the
			// bottom of the document by the backend's renderFootnotes hook, once
			// every step has been rendered.
			return `[^${renderId}-${index}]`;
		}
		if (format === "html") {
			return `<span class="inline-comment">${escapeHtml(text)}</span>`;
		}
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

				const altNames = item.options
					.slice(1)
					.map((opt: any) => opt.name || opt.display || opt.id);

				let html = formatElement(resolvedOpt, format, context);
				html += ` <span class="ingredient-alt-badge" data-tooltip="${escapeHtml(t.renderer.alternatives)}:\n${escapeHtml(altNames.join("\n"))}">(alt)</span>`;
				return html;
			} else {
				const separator = ' <span class="keyword">or</span> ';
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
			const separator = " or ";
			return item.options
				.map((opt: any) => {
					const isCookware = opt.type === "cookware" || !!cookwareList[opt.id];
					const resolvedOpt = {
						...opt,
						type: opt.type || (isCookware ? "cookware" : "ingredient"),
					};
					return formatElement(resolvedOpt, format, context);
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
		return format === "html" ? escapeHtml(text) : escapeMarkdownHtml(text);
	},
};

/**
 * Entry point to format an AST element for either the html or md backend.
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
	format: "html" | "md",
	context: RenderContext = {},
): string {
	if (element === null || element === undefined) return "";
	if (typeof element === "string") {
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

	return format === "html"
		? escapeHtml(String(el.value || ""))
		: escapeMarkdownHtml(String(el.value || ""));
}

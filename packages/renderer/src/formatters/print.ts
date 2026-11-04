import type {
	RendererOptions,
	RenderContext,
	RenderableCompilationResult,
	RenderableMetrics,
} from "../types";
import type { RenderBackend, RenderSections } from "../traversal";
import { renderRecipe } from "../traversal";
import {
	formatDuration as defaultFormatDuration,
	escapeHtml,
	aggToRendererItem,
	isAlternativeGroup,
	isCompositeItem,
	joinStepTokens,
	groupMultiUnitEntries,
	round1,
} from "../utils";
import {
	getMetrics,
	hasNutritionToShow,
	nutritionRows,
	resolveNutritionBasis,
} from "../nutrition";
import { formatElement } from "./element";
import { moduleLabel } from "./shared";
import { aggregateSectionIngredients } from "@gram-lang/kitchen";
import { getDictionary } from "@gram-lang/i18n";
import { timesOf } from "../mise-en-place";
import { runSheetToHTML } from "../run-sheet";
import { RUN_SHEET_PRINT_CSS } from "../run-sheet-css";
import css from "./print.css" with { type: "text" };

/** The print stylesheet (`print.css`), shared by every printed view. */
export const PRINT_CSS: string = css;

import { PRINT_ICONS } from "../icons";

const printBackend: RenderBackend = {
	buildContext(data, options) {
		const registry = data.registry || { ingredients: {}, cookware: {} };
		const formatDuration = options.formatDuration || defaultFormatDuration;
		return {
			registry,
			icons: options.icons ? { ...PRINT_ICONS, ...options.icons } : PRINT_ICONS,
			formatDuration,
			formatFraction: options.formatFraction,
			bakersMathOnly: options.bakersMathOnly,
			lang: options.lang,
			// Footnotes are collected here too, rendered as endnotes via
			// renderFootnotes, matching html.ts.
			_inlineComments: [],
			_renderId: options.renderId ?? "note",
		};
	},

	renderTitle(data) {
		return data.title ? `<h1>${escapeHtml(data.title)}</h1>\n` : "";
	},

	renderMeta(data, _context, options) {
		const t = getDictionary(options.lang);
		const formatDuration = options.formatDuration || defaultFormatDuration;
		// See RenderableMetrics's own comment: a plain (un-analyzed) compile()
		// result's `metrics` never carries mass/nutrition fields at all.
		const metrics = data.metrics as RenderableMetrics;

		let body = `<div class="meta">\n`;
		if (metrics) {
			// Total and idle time follow the chosen schedule; the other two do not.
			const { totalTime, idleTime } = timesOf(data, options);
			if (totalTime) {
				body += `  <span class="meta-item"><span class="meta-label">${t.renderer.totalTime}</span>${formatDuration(totalTime)}</span>\n`;
			}
			if (idleTime) {
				body += `  <span class="meta-item"><span class="meta-label">${t.renderer.idleTime}</span>${formatDuration(idleTime)}</span>\n`;
			}
			if (metrics.activeTime) {
				body += `  <span class="meta-item"><span class="meta-label">${t.renderer.activeTime}</span>${formatDuration(metrics.activeTime)}</span>\n`;
			}
			if (metrics.preparationTime) {
				body += `  <span class="meta-item"><span class="meta-label">${t.renderer.prepTime}</span>${formatDuration(metrics.preparationTime)} <em style="opacity:0.55;font-size:0.85em">${t.renderer.est}</em></span>\n`;
			}
		}
		if (data.meta) {
			for (const [k, v] of Object.entries(data.meta)) {
				if (k === "title") continue;
				const label = k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " ");
				body += `  <span class="meta-item"><span class="meta-label">${escapeHtml(label)}</span>${escapeHtml(String(v))}</span>\n`;
			}
		}
		body += `</div>\n\n`;
		return body;
	},

	renderShoppingList(data, context, options) {
		if (!(data.shopping_list?.length > 0)) return "";
		const t = getDictionary(options.lang);
		let body = `<div class="shopping-list">\n<h2>${t.renderer.shoppingList}</h2>\n<ul>\n`;
		// Same as html.ts's shoppingItems: isAlternativeGroup/isCompositeItem
		// are plain boolean checks, not type predicates, so the union stays
		// unnarrowed after them — matches the existing pattern here rather
		// than introducing a new one.
		const shoppingItems: any[] = data.shopping_list.filter(
			(item: unknown) => item && typeof item === "object",
		);
		const renderGroups = groupMultiUnitEntries(shoppingItems);
		for (const group of renderGroups) {
			const item = group[0];
			if (isAlternativeGroup(item)) {
				body += `  <li>${item.options.map((o: any) => formatElement(o, "html", { ...context, formatMode: "shopping-list" })).join(" <em>or</em> ")}</li>\n`;
			} else if (isCompositeItem(item)) {
				body += `  <li>${formatElement(item, "html", { ...context, formatMode: "shopping-list" })}</li>\n`;
				for (const u of item.usage ?? []) {
					body += `  <li style="padding-left:12pt">${formatElement(u, "html", { ...context, formatMode: "shopping-list" })}</li>\n`;
				}
			} else if (item.display) {
				body += `  <li>${escapeHtml(item.display)}</li>\n`;
			} else if (group.length > 1) {
				body += `  <li class="list-item-group">\n`;
				body += `    <strong>${escapeHtml(item.name || item.id)}</strong> <span class="mixed-units-badge">${escapeHtml(t.renderer.mixedUnits)}</span>\n`;
				body += `    <ul>\n`;
				group.forEach((entry) => {
					body += `      <li>${formatElement(entry, "html", { ...context, formatMode: "shopping-list" })}</li>\n`;
				});
				body += `    </ul>\n`;
				body += `  </li>\n`;
			} else {
				let extra = "";
				if (
					item.purchasingMass &&
					item.purchasingMass !== item.normalizedMass
				) {
					const gross = round1(item.purchasingMass);
					extra = ` <span class="gross-mass">${gross}g ${escapeHtml(t.renderer.gross)}</span>`;
				}
				body += `  <li>${formatElement(item, "html", { ...context, formatMode: "shopping-list" })}${extra}</li>\n`;
			}
		}
		body += `</ul>\n</div>\n\n`;
		return body;
	},

	renderCookware(data, context, options) {
		if (!(data.cookware?.length > 0)) return "";
		const t = getDictionary(options.lang);
		let body = `<div>\n<h2>${t.renderer.equipment}</h2>\n<div class="cookware-list">\n`;
		for (const cw of data.cookware) {
			if (isAlternativeGroup(cw)) {
				const opts = (cw.options ?? [])
					.map((o: any) => formatElement(o, "html", context))
					.join(" or ");
				body += `  <span class="cw-item">${opts}</span>\n`;
			} else {
				body += `  <span class="cw-item">${formatElement(cw, "html", context)}</span>\n`;
			}
		}
		body += `</div>\n</div>\n\n`;
		return body;
	},

	renderInstructions(data, context, options) {
		if (!(data.sections?.length > 0)) return "";
		// Context variant used when rendering inline step tokens — hides qty if flag is set
		const stepContext: RenderContext = options.hideStepQty
			? { ...context, hideIngredientQty: true }
			: context;

		let body = `<div class="instructions">\n<h2>Instructions</h2>\n`;
		for (const sec of data.sections) {
			body += `<section>\n`;
			if (sec.title) {
				let titleHtml = escapeHtml(sec.title);
				if (sec.retro_planning)
					titleHtml += ` <small style="opacity:0.55;font-size:0.8em">(${escapeHtml(sec.retro_planning.raw)})</small>`;
				if (sec.module) {
					titleHtml += ` <small style="opacity:0.55;font-size:0.8em">(${escapeHtml(moduleLabel(sec.module))})</small>`;
				}
				body += `  <h3>${titleHtml}</h3>\n`;
			}

			// Section-level ingredients — aggregated (dedup, addition, intermediates)
			const secItems = aggregateSectionIngredients(sec.ingredients ?? []).map(
				aggToRendererItem,
			);
			if (secItems.length > 0) {
				body += `  <div class="section-ingredients"><ul>\n`;
				for (const ing of secItems) {
					body += `    <li>${formatElement(ing, "html", { ...context, formatMode: "mise-en-place" })}</li>\n`;
				}
				body += `  </ul></div>\n`;
			}

			body += `  <ol class="steps">\n`;
			let stepCounter = 0;
			for (const stepItem of sec.steps ?? []) {
				if (!stepItem) continue;
				if (stepItem.type === "comment") {
					body += `    <li class="comment-step"><em>${escapeHtml(stepItem.value ?? "")}</em></li>\n`;
					continue;
				}
				stepCounter++;
				body += `    <li value="${stepCounter}">\n`;

				if (stepItem.action) {
					body += `      <span class="action">${escapeHtml(stepItem.action)}</span>`;
				}

				const stepContent = joinStepTokens(
					stepItem.content ?? [],
					(c) => formatElement(c, "html", stepContext),
					(c) => !!c && typeof c === "object" && c.type !== "comment",
				);

				body += stepContent ? `      ${stepContent}\n` : "";
				body += `    </li>\n`;
			}
			body += `  </ol>\n</section>\n`;
		}
		body += `</div>\n\n`;
		return body;
	},

	renderFootnotes(_data, context, options) {
		// Rendered as endnotes at the bottom of the printed page — element.ts's
		// comment strategy emits the matching footnote-ref markup inline (print
		// always formats tokens as "html", same as html.ts).
		if (!context._inlineComments || context._inlineComments.length === 0) {
			return "";
		}
		const t = getDictionary(options.lang);
		const renderId = context._renderId || "note";
		let body = `<div class="notes">\n<h2>Notes</h2>\n<ol>\n`;
		context._inlineComments.forEach((note, idx) => {
			const index = idx + 1;
			body += `  <li id="${renderId}-${index}">${escapeHtml(note)} <a href="#ref-${renderId}-${index}" class="note-return" title="${escapeHtml(t.renderer.returnToStep)}">↩</a></li>\n`;
		});
		body += `</ol>\n</div>\n\n`;
		return body;
	},

	renderNutrition(data, _context, options) {
		const t = getDictionary(options.lang);
		const nut = getMetrics(data)?.nutrition;
		// Print used to require calories > 0, so a recipe whose ingredients are
		// all missing from the database printed no panel at all — not even the
		// warnings explaining why. It now shares html/markdown's condition.
		if (!hasNutritionToShow(nut) || !nut) return "";

		const basis = resolveNutritionBasis(
			nut,
			options.nutritionBasis,
			options.lang,
		);

		let body = `<div class="nutrition">\n<h2>${escapeHtml(t.renderer.nutrition)} <small>(${escapeHtml(basis.label)})</small></h2>\n`;
		// A printed sheet is the one output the cook can't click into for more
		// context, so the reason a total is partial has to be on the page.
		if (nut.warnings && nut.warnings.length > 0) {
			body += `<div class="nut-warnings">\n`;
			nut.warnings.forEach((w) => {
				body += `  <p><strong>${escapeHtml(t.renderer.incompleteData)}:</strong> ${escapeHtml(w.message)}</p>\n`;
			});
			body += `</div>\n`;
		}
		if (basis.note) {
			body += `<p class="nut-basis-note">${escapeHtml(basis.note)}</p>\n`;
		}
		body += `<div class="nut-grid">\n`;
		for (const row of nutritionRows(basis.values, options.lang)) {
			const cls = row.nested ? "nut-item nut-item-nested" : "nut-item";
			body += `  <span class="${cls}"><small>${escapeHtml(row.label)}</small> <strong>${row.value} ${row.unit}</strong></span>\n`;
		}
		body += `</div>\n</div>\n`;
		return body;
	},

	renderRunSheet(data, options, sheet) {
		return runSheetToHTML(sheet, data, {
			lang: options.lang,
			comments: options.comments,
		});
	},

	assembleDocument(sections: RenderSections, data, _context, options) {
		const body =
			sections.title +
			sections.meta +
			sections.shoppingList +
			sections.cookware +
			sections.instructions +
			sections.footnotes +
			sections.nutrition +
			sections.runSheet;

		const titleTag = data.title
			? `<title>${escapeHtml(data.title)}</title>`
			: "<title>Recipe</title>";
		return `<!DOCTYPE html>
<html lang="${escapeHtml(String(data.meta?.language ?? "en"))}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${titleTag}
  <style>${PRINT_CSS}${options.runSheet ? RUN_SHEET_PRINT_CSS : ""}</style>
</head>
<body>
${body}</body>
</html>`;
	},
};

export function toPrintHTML(
	data: RenderableCompilationResult,
	options: RendererOptions = {},
): string {
	return renderRecipe(data, options, printBackend);
}

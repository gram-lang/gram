import type {
	RendererOptions,
	RenderContext,
	RenderableCompilationResult,
} from "../types";
import type { RenderBackend, RenderSections } from "../traversal";
import { renderRecipe } from "../traversal";
import {
	formatDuration as defaultFormatDuration,
	aggToRendererItem,
	isAlternativeGroup,
	isCompositeItem,
	joinStepTokens,
	groupMultiUnitEntries,
	escapeMarkdownHtml,
} from "../utils";
import {
	getMetrics,
	hasNutritionToShow,
	nutritionRows,
	resolveNutritionBasis,
} from "../nutrition";
import { formatElement } from "./element";
import { aggregateSectionIngredients } from "@gram-lang/kitchen";
import { getDictionary } from "@gram-lang/i18n";

const markdownBackend: RenderBackend = {
	buildContext(data, options) {
		const registry = data.registry || { ingredients: {}, cookware: {} };
		const formatDuration = options.formatDuration || defaultFormatDuration;
		return {
			registry,
			icons: options.icons,
			classes: options.classes,
			formatDuration,
			formatFraction: options.formatFraction,
			bakersMathOnly: options.bakersMathOnly,
			lang: options.lang,
			// Footnotes are collected here too (GFM `[^id]` refs + definitions at
			// the bottom via renderFootnotes), matching html.ts's behavior.
			_inlineComments: [],
			_renderId: options.renderId ?? "note",
		};
	},

	renderTitle(data) {
		return data.title ? `# ${escapeMarkdownHtml(data.title)}\n\n` : "";
	},

	renderMeta(data, _context, options) {
		if (!((data.meta && Object.keys(data.meta).length > 0) || data.metrics)) {
			return "";
		}
		const t = getDictionary(options.lang);
		const formatDuration = options.formatDuration || defaultFormatDuration;

		let md = `> **Metadata**\n`;
		if (data.metrics) {
			if (data.metrics.totalTime) {
				md += `> - **${t.renderer.totalTime}**: ${formatDuration(data.metrics.totalTime)}\n`;
			}
			if (data.metrics.idleTime) {
				md += `> - **${t.renderer.idleTime}**: ${formatDuration(data.metrics.idleTime)}\n`;
			}
			if (data.metrics.activeTime) {
				md += `> - **${t.renderer.activeTime}**: ${formatDuration(data.metrics.activeTime)}\n`;
			}
			if (data.metrics.preparationTime) {
				md += `> - **${t.renderer.prepTime}**: ${formatDuration(data.metrics.preparationTime)} ${t.renderer.est}\n`;
			}
		}
		if (data.meta) {
			for (const [k, v] of Object.entries(data.meta)) {
				if (k !== "title")
					md += `> - ${escapeMarkdownHtml(k)}: ${escapeMarkdownHtml(String(v))}\n`;
			}
		}
		md += "\n";
		return md;
	},

	renderShoppingList(data, context, options) {
		if (!data.shopping_list || data.shopping_list.length === 0) return "";
		const t = getDictionary(options.lang);
		let md = `## 🛒 ${t.renderer.shoppingList}\n\n`;

		const shoppingItems: any[] = data.shopping_list;
		const renderGroups = groupMultiUnitEntries(shoppingItems);

		renderGroups.forEach((group) => {
			const item = group[0];
			if (isAlternativeGroup(item)) {
				// strategies.alternative already joins every option ("egg or egg
				// substitute") on one line — reuse it instead of hand-rolling the
				// same join as a nested sub-list.
				md += `- ${formatElement(item, "md", { ...context, formatMode: "shopping-list" })}\n`;
			} else if (isCompositeItem(item)) {
				const parentStr = formatElement(item, "md", {
					...context,
					formatMode: "shopping-list",
				});
				md += `- ${parentStr} **(Composite)**:\n`;
				item.usage.forEach((child: any) => {
					md += `  - ${formatElement(child, "md", { ...context, formatMode: "shopping-list" })}\n`;
				});
			} else if (item.display) {
				md += `- ${escapeMarkdownHtml(item.display)}\n`;
			} else if (group.length > 1) {
				md += `- **${item.name || item.id}** ⚠️ *${t.renderer.mixedUnits}*:\n`;
				group.forEach((entry) => {
					md += `  - ${formatElement(entry, "md", { ...context, formatMode: "shopping-list" })}\n`;
				});
			} else {
				let suffix = "";
				if (
					item.purchasingMass &&
					item.purchasingMass !== item.normalizedMass
				) {
					const gross = Math.round(item.purchasingMass * 10) / 10;
					suffix = ` _(${gross}g ${t.renderer.gross})_`;
				}
				md += `- ${formatElement(item, "md", { ...context, formatMode: "shopping-list" })}${suffix}\n`;
			}
		});
		md += "\n";
		return md;
	},

	renderCookware(data, context) {
		if (!data.cookware || data.cookware.length === 0) return "";
		const t = getDictionary(context.lang);
		let md = `## 🍳 ${t.renderer.cookware}\n\n`;
		data.cookware.forEach((cw: any) => {
			// formatElement dispatches on cw.type, so this already handles both a
			// plain cookware item and an alternative group ("pan or skillet",
			// joined on one line by strategies.alternative) with the same call.
			md += `- ${formatElement(cw, "md", context)}\n`;
		});
		md += "\n";
		return md;
	},

	renderInstructions(data, context, options) {
		if (!data.sections || data.sections.length === 0) return "";
		// Context variant used when rendering inline step tokens — hides qty if flag is set
		// (not from shopping list or section mise en place, matches print.ts's stepContext).
		const stepContext: RenderContext = options.hideStepQty
			? { ...context, hideIngredientQty: true }
			: context;

		let md = `## 👨‍🍳 Instructions\n\n`;
		data.sections.forEach((sec: any) => {
			if (sec.title) {
				md += `### ${escapeMarkdownHtml(sec.title)}`;
				if (sec.retro_planning)
					md += ` ~{${escapeMarkdownHtml(sec.retro_planning.raw)}}`;
				md += `\n\n`;
			}

			// Section Ingredients — aggregated to remove duplicates and apply addition/segregation rules
			const sectionItems = aggregateSectionIngredients(
				sec.ingredients ?? [],
			).map(aggToRendererItem);
			if (sectionItems.length > 0) {
				md += `**Ingredients**:\n`;
				sectionItems.forEach((item: any) => {
					md += `- ${formatElement(item, "md", { ...context, formatMode: "mise-en-place" })}\n`;
				});
				md += "\n";
			}

			let stepCounter = 0;
			sec.steps.forEach((step: any) => {
				if (step.type === "comment") {
					const commentText = step.value ? step.value.trim() : "";
					md += `> *${escapeMarkdownHtml(commentText)}*\n\n`;
					return;
				}

				stepCounter++;
				const stepNum = stepCounter;
				let stepText = "";

				if (step.action) {
					stepText += `**[${escapeMarkdownHtml(step.action)}]** `;
				}
				stepText += joinStepTokens(
					step.content,
					(c) => formatElement(c, "md", stepContext),
					(c) => typeof c !== "string" && c.type !== "comment",
				);
				md += `${stepNum}. ${stepText}\n`;
			});
			md += "\n";
		});
		return md;
	},

	renderFootnotes(_data, context) {
		// Uses GFM `[^id]: text` footnote definitions at the bottom of the
		// document — element.ts's comment strategy emits the matching `[^id]`
		// reference inline.
		if (!context._inlineComments || context._inlineComments.length === 0) {
			return "";
		}
		const renderId = context._renderId || "note";
		let md = "\n---\n\n";
		context._inlineComments.forEach((note, idx) => {
			const index = idx + 1;
			md += `[^${renderId}-${index}]: ${escapeMarkdownHtml(note)}\n`;
		});
		return md;
	},

	renderNutrition(data, _context, options) {
		const t = getDictionary(options.lang);
		const nut = getMetrics(data)?.nutrition;
		if (!hasNutritionToShow(nut) || !nut) return "";

		const basis = resolveNutritionBasis(
			nut,
			options.nutritionBasis,
			options.lang,
		);

		let md = `## 🥗 ${t.renderer.nutrition} (${basis.label})\n\n`;
		if (basis.note) md += `_${escapeMarkdownHtml(basis.note)}_\n\n`;
		if (nut.warnings && nut.warnings.length > 0) {
			nut.warnings.forEach((w) => {
				md += `> **${t.renderer.incompleteData}:** ${escapeMarkdownHtml(w.message)}\n`;
			});
			md += "\n";
		}
		for (const row of nutritionRows(basis.values, options.lang)) {
			const indent = row.nested ? "  " : "";
			md += `${indent}- **${escapeMarkdownHtml(row.label)}**: ${row.value} ${row.unit}\n`;
		}
		md += "\n";
		return md;
	},

	assembleDocument(sections: RenderSections) {
		return (
			sections.title +
			sections.meta +
			sections.shoppingList +
			sections.cookware +
			sections.instructions +
			sections.footnotes +
			sections.nutrition
		);
	},
};

export function toMarkdown(
	data: RenderableCompilationResult,
	options: RendererOptions = {},
): string {
	return renderRecipe(data, options, markdownBackend);
}

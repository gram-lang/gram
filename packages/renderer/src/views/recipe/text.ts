import { aggregateSectionIngredients } from "@gram-lang/kitchen";
import { getDictionary } from "@gram-lang/i18n";
import { formatElement } from "../../shared/element";
import {
	getMetrics,
	hasNutritionToShow,
	nutritionRows,
	resolveNutritionBasis,
} from "../../shared/nutrition";
import { servingsLabel } from "../../shared/servings";
import {
	aggToRendererItem,
	formatDuration as defaultFormatDuration,
	groupMultiUnitEntries,
	isAlternativeGroup,
	isCompositeItem,
	joinStepTokens,
	round1,
} from "../../shared/utils";
import type {
	RenderableCompilationResult,
	RenderContext,
	RendererOptions,
	TextStyle,
} from "../../types";
import { moduleLabel } from "./module-label";
import {
	type RenderBackend,
	type RenderSections,
	renderRecipe,
	timesIn,
} from "./traversal";

/** What the text format reads of a shopping-list entry. */
interface ShoppingEntry {
	type?: string;
	id?: string;
	name?: string;
	multiUnit?: boolean;
	/** A line already written by the analyzer. */
	display?: string;
	/** The parts of a composite ingredient. */
	usage?: unknown[];
	normalizedMass?: number;
	/** The mass to buy, waste included, when it differs from the mass used. */
	purchasingMass?: number;
}

/** The width of the rules and of the title box when the surface gives none. */
export const DEFAULT_TEXT_WIDTH = 78;
/** The narrowest the title box can be drawn. */
const MIN_WIDTH = 32;
/** The column the quantities line up on, in a list. */
const SHOPPING_COLUMN = 22;
const SECTION_COLUMN = 20;

const widthOf = (options: RendererOptions) =>
	Math.max(MIN_WIDTH, Math.floor(options.width ?? DEFAULT_TEXT_WIDTH));

const style = (
	options: { textStyle?: TextStyle },
	kind: keyof TextStyle,
	text: string,
) => options.textStyle?.[kind]?.(text) ?? text;

const upper = (text: string, lang?: string) =>
	text.toLocaleUpperCase(lang || "en");

/** The heading of a part of the recipe, in capitals: `SHOPPING LIST`. */
const heading = (options: RendererOptions, text: string) =>
	style(options, "heading", upper(text, options.lang));

/** A rule across the width, with the title of a section in it when it has one. */
function rule(options: RendererOptions, label?: string): string {
	const width = widthOf(options);
	if (!label) return style(options, "dim", "─".repeat(width));
	const lead = "─── ";
	const rest = Math.max(3, width - lead.length - label.length - 1);
	return `${style(options, "dim", lead)}${style(options, "heading", label)} ${style(options, "dim", "─".repeat(rest))}`;
}

/** Packs the parts on as few lines as fit the width, separated by `·`. */
function packLine(parts: string[], width: number): string[] {
	const lines: string[] = [];
	let line = "";
	for (const part of parts) {
		const next = line ? `${line}  ·  ${part}` : part;
		if (line && next.length > width) {
			lines.push(line);
			line = part;
		} else {
			line = next;
		}
	}
	if (line) lines.push(line);
	return lines;
}

/**
 * The recipe as plain text, for a terminal or a plain file: a box with the
 * title, the servings and the times, then the shopping list, the cookware,
 * each section (its ingredients, then its numbered steps), the notes and the
 * nutrition. No markup and no escaping: the text of the recipe is written as
 * it is. A surface that can show colors passes a `textStyle`.
 */
export const textBackend: RenderBackend = {
	buildContext(data, options) {
		return {
			registry: data.registry || { ingredients: {}, cookware: {} },
			formatDuration: options.formatDuration || defaultFormatDuration,
			formatFraction: options.formatFraction,
			bakersMathOnly: options.bakersMathOnly,
			lang: options.lang,
			textStyle: options.textStyle,
			// The comments at the end of a line become numbered notes, under the
			// steps, as in the other formats.
			_inlineComments: [],
			_renderId: options.renderId ?? "note",
		};
	},

	renderTitle(data, context, options) {
		const t = getDictionary(options.lang).renderer;
		const width = widthOf(options);
		const servings = servingsLabel(data, options.lang);
		const tail = servings ? ` ${servings} ` : "";
		const room = width - 8 - tail.length;
		const raw = data.title || "";
		const title =
			raw.length > room ? `${raw.slice(0, Math.max(1, room - 1))}…` : raw;
		const fill = "─".repeat(
			Math.max(2, width - 6 - title.length - tail.length),
		);
		const lines = [style(options, "title", `┌─ ${title} ${fill}${tail}─┐`)];

		if (data.metrics) {
			const formatDuration = context.formatDuration ?? defaultFormatDuration;
			const { totalTime, idleTime } = timesIn(context);
			const parts: string[] = [];
			const part = (label: string, minutes: number, suffix = "") => {
				if (minutes) {
					parts.push(`${label}${t.colon}${formatDuration(minutes)}${suffix}`);
				}
			};
			part(t.prepTime, data.metrics.preparationTime ?? 0, ` ${t.est}`);
			part(t.activeTime, data.metrics.activeTime ?? 0);
			part(t.idleTime, idleTime);
			part(t.totalTime, totalTime);
			const inner = width - 5;
			for (const line of packLine(parts, inner)) {
				lines.push(
					`${style(options, "title", "│  ")}${style(options, "dim", line.padEnd(inner))}${style(options, "title", " │")}`,
				);
			}
		}

		lines.push(style(options, "title", `└${"─".repeat(width - 2)}┘`));
		return `${lines.join("\n")}\n`;
	},

	renderMeta() {
		// The servings and the times are in the title box; the rest of the
		// frontmatter (author, tags...) is for the other formats.
		return "";
	},

	renderShoppingList(data, context, options) {
		if (!data.shopping_list || data.shopping_list.length === 0) return "";
		const t = getDictionary(options.lang).renderer;
		const row: RenderContext = {
			...context,
			formatMode: "shopping-list",
			textColumn: SHOPPING_COLUMN,
		};
		const lines = ["", heading(options, t.shoppingList)];
		const child = (item: unknown) =>
			`    ${style(options, "dim", "↳")} ${formatElement(item, "text", { ...row, textColumn: SHOPPING_COLUMN - 4 })}`;

		const entries = data.shopping_list as ShoppingEntry[];
		for (const group of groupMultiUnitEntries(entries)) {
			const item = group[0];
			if (!item) continue;
			if (isAlternativeGroup(item)) {
				lines.push(`  ${formatElement(item, "text", row)}`);
			} else if (isCompositeItem(item)) {
				lines.push(`  ${formatElement(item, "text", row)}`);
				for (const usage of item.usage ?? []) lines.push(child(usage));
			} else if (item.display) {
				lines.push(`  ${item.display}`);
			} else if (group.length > 1) {
				lines.push(
					`  ${style(options, "ingredient", item.name || item.id || "")}  ⚠ ${style(options, "dim", t.mixedUnits)}`,
				);
				for (const entry of group) lines.push(child(entry));
			} else {
				let gross = "";
				if (
					item.purchasingMass &&
					item.purchasingMass !== item.normalizedMass
				) {
					gross = ` ${style(options, "dim", `(${round1(item.purchasingMass)} g ${t.gross})`)}`;
				}
				lines.push(`  ${formatElement(item, "text", row)}${gross}`);
			}
		}
		return `${lines.join("\n")}\n`;
	},

	renderCookware(data, context, options) {
		if (!data.cookware || data.cookware.length === 0) return "";
		const t = getDictionary(options.lang).renderer;
		const row: RenderContext = {
			...context,
			formatMode: "shopping-list",
			textColumn: SHOPPING_COLUMN,
		};
		const lines = ["", heading(options, t.cookware)];
		for (const item of data.cookware) {
			lines.push(`  ${formatElement(item, "text", row)}`);
		}
		return `${lines.join("\n")}\n`;
	},

	renderInstructions(data, context, options) {
		if (!data.sections || data.sections.length === 0) return "";
		// Quantities in the text of a step follow `stepQuantities`; the lists
		// of ingredients always show them.
		const stepContext: RenderContext = options.hideStepQty
			? { ...context, hideIngredientQty: true }
			: context;
		const listContext: RenderContext = {
			...context,
			formatMode: "mise-en-place",
			textColumn: SECTION_COLUMN,
		};
		const dim = (text: string) => style(options, "dim", text);
		const lines: string[] = [];

		for (const section of data.sections) {
			let label = section.title ?? undefined;
			if (label && section.module) {
				label = `${label} (${moduleLabel(section.module)})`;
			}
			lines.push("", rule(options, label));

			const items = aggregateSectionIngredients(section.ingredients ?? []).map(
				aggToRendererItem,
			);
			// The parts of a composite ingredient go under it, as in the
			// shopping list, rather than each repeating its name.
			const entries: { label?: string; items: Record<string, unknown>[] }[] =
				[];
			const composites = new Map<string, Record<string, unknown>[]>();
			for (const item of items) {
				const parent = item.parent as string | undefined;
				if (!parent) {
					entries.push({ items: [item] });
					continue;
				}
				const label = item.parentPreparation
					? `${parent}, ${item.parentPreparation}`
					: parent;
				const { parent: _parent, parentPreparation: _prep, ...part } = item;
				const parts = composites.get(label);
				if (parts) {
					parts.push(part);
				} else {
					composites.set(label, [part]);
					entries.push({ label, items: composites.get(label) ?? [] });
				}
			}
			const partContext = { ...listContext, textColumn: SECTION_COLUMN - 2 };
			for (const entry of entries) {
				if (entry.label === undefined) {
					lines.push(
						`  ${dim("•")} ${formatElement(entry.items[0], "text", listContext)}`,
					);
					continue;
				}
				lines.push(
					`  ${dim("•")} ${style(options, "ingredient", entry.label)}`,
				);
				for (const part of entry.items) {
					lines.push(
						`    ${dim("↳")} ${formatElement(part, "text", partContext)}`,
					);
				}
			}
			if (entries.length > 0) lines.push("");

			let number = 0;
			for (const step of section.steps) {
				if (step.type === "comment") {
					const text = String(step.value ?? "").trim();
					if (text) lines.push(`      ${dim(text)}`);
					continue;
				}
				number++;
				const action = step.action
					? `${style(options, "action", `[${step.action}]`)} `
					: "";
				const text = joinStepTokens(
					step.content,
					(c) => formatElement(c, "text", stepContext),
					(c) => typeof c !== "string" && c.type !== "comment",
				)
					.replace(/\s+/g, " ")
					.trim();
				lines.push(
					`  ${dim(`${String(number).padStart(2)}.`)} ${action}${text}`,
				);
			}
		}
		return `${lines.join("\n")}\n`;
	},

	renderFootnotes(_data, context, options) {
		const notes = context._inlineComments ?? [];
		if (notes.length === 0) return "";
		const t = getDictionary(options.lang).renderer;
		const lines = ["", heading(options, t.notes)];
		notes.forEach((note, i) => {
			lines.push(`  ${style(options, "dim", `[${i + 1}]`)} ${note}`);
		});
		return `${lines.join("\n")}\n`;
	},

	renderNutrition(data, _context, options) {
		const nutrition = getMetrics(data)?.nutrition;
		if (!hasNutritionToShow(nutrition) || !nutrition) return "";
		const t = getDictionary(options.lang).renderer;
		const basis = resolveNutritionBasis(
			nutrition,
			options.nutritionBasis,
			options.lang,
		);
		const rows = nutritionRows(basis.values, options.lang);
		if (rows.length === 0) return "";
		const number = new Intl.NumberFormat(options.lang || "en", {
			maximumFractionDigits: 1,
		});
		const labels = rows.map((row) =>
			row.nested ? `  ${row.label}` : row.label,
		);
		const column = Math.max(...labels.map((label) => label.length)) + 2;
		const lines = ["", heading(options, `${t.nutrition} (${basis.label})`)];
		rows.forEach((row, i) => {
			const value =
				row.unit === "kcal"
					? Math.round(row.value).toString()
					: number.format(row.value);
			lines.push(`  ${(labels[i] ?? "").padEnd(column)}${value} ${row.unit}`);
		});
		if (basis.note) lines.push(style(options, "dim", `  ${basis.note}`));
		for (const warning of nutrition.warnings ?? []) {
			lines.push(
				style(
					options,
					"dim",
					`  ⚠ ${t.incompleteData}${t.colon}${warning.message}`,
				),
			);
		}
		return `${lines.join("\n")}\n`;
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

/** The recipe as plain text (see `textBackend`). */
export function toText(
	data: RenderableCompilationResult,
	options: RendererOptions = {},
): string {
	return renderRecipe(data, options, textBackend);
}

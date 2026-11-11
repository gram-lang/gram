import type {
	RendererOptions,
	RenderContext,
	RenderableCompilationResult,
	RenderableMetrics,
} from "../../types";
import type { RenderBackend, RenderSections } from "./traversal";
import { renderRecipe, timesIn } from "./traversal";
import {
	formatDuration as defaultFormatDuration,
	escapeHtml,
	aggToRendererItem,
	isAlternativeGroup,
	isCompositeItem,
	joinStepTokens,
	nobr,
	groupMultiUnitEntries,
	round1,
	getQty,
	trimBeforeComments,
} from "../../shared/utils";
import {
	availableBases,
	getMetrics,
	hasNutritionToShow,
	kcalToKj,
	nutritionColumns,
	nutritionRows,
	referenceIntakePercent,
	resolveNutritionBasis,
	type NutrientRow,
	wholeRecipeBelow,
	type ResolvedBasis,
} from "../../shared/nutrition";
import { describeMiseEnPlaceItem } from "../../shared/mise-en-place";
import { formatElement, DEFAULT_ICONS } from "../../shared/element";
import { RESET_SCALE_ICON } from "../../shared/icons";
import {
	formatScaleFactor,
	portionsLabel,
	portionsUnit,
} from "../../shared/portions";
import { moduleLabel } from "./module-label";
import {
	aggregateSectionIngredients,
	intermediateLabel,
	round2,
	type TimeBreakdownItem,
} from "@gram-lang/kitchen";
import { getDictionary } from "@gram-lang/i18n";
import {
	resolveContributingUsage,
	type AnalyzedUsage,
	type MassMetrics,
	type NutritionMetrics,
} from "@gram-lang/analyzer";

type Dictionary = ReturnType<typeof getDictionary>;

/**
 * An entry of the shopping list, the cookware or a step's result, as the kit
 * lines read it: the compiled usage, shopping item or composite, with the
 * analyzer's masses when it ran.
 */
type KitItem = {
	id?: string;
	name?: string;
	alias?: string;
	type?: string;
	unit?: string;
	quantity?: unknown;
	qty?: unknown;
	preparation?: string;
	note?: string;
	parent?: string;
	parentPreparation?: string;
	normalizedMass?: number;
	purchasingMass?: number;
	isEstimate?: boolean;
	bakersPercentage?: number;
	multiUnit?: boolean;
	options?: KitItem[];
	usage?: KitItem[];
	[key: string]: unknown;
};

/**
 * The quantity column of a kit line: the written quantity when it differs
 * from the standardized mass, the mass itself (or the written quantity when
 * there is no mass), then the baker's percentage and the gross mass.
 * `showBareCount` also shows a quantity with neither mass nor unit (2 egg
 * yolks), which a plain line leaves out; `withBadges: false` drops the
 * baker's percentage and the gross mass.
 */
function kitQtyHtml(
	item: KitItem,
	qty: unknown,
	t: Dictionary,
	{
		isCookware = false,
		showBareCount = false,
		withBadges = true,
	}: {
		isCookware?: boolean;
		showBareCount?: boolean;
		withBadges?: boolean;
	} = {},
): string {
	let html = "";
	const unitStr = item.unit ? ` ${escapeHtml(item.unit)}` : "";
	if (qty && item.normalizedMass && round1(item.normalizedMass) !== qty) {
		html += `<span class="kit-orig">${escapeHtml(String(qty))}${unitStr}</span>`;
	}
	if (item.normalizedMass) {
		const isEst = item.isEstimate ? "~" : "";
		html += `<span class="kit-mass">${isEst}${round1(item.normalizedMass)} g</span>`;
	} else if (qty && !isCookware && (item.unit || showBareCount)) {
		html += `<span class="kit-mass">${escapeHtml(String(qty))}${unitStr}</span>`;
	}
	if (!withBadges) return html;
	if (item.bakersPercentage !== undefined) {
		html += ` <span class="bakers-badge">${round1(item.bakersPercentage)}%</span>`;
	}
	if (item.purchasingMass && item.purchasingMass !== item.normalizedMass) {
		const gross = round1(item.purchasingMass);
		html += ` <span class="gross-mass" data-tooltip="${escapeHtml(t.renderer.purchasingWeight)}">(${gross}g ${escapeHtml(t.renderer.gross)})</span>`;
	}
	return html;
}

function renderKitItem(
	item: KitItem,
	context: RenderContext,
	options: RendererOptions,
): string {
	const t = getDictionary(options.lang);
	const regIng = item.id ? context.registry?.ingredients?.[item.id] : undefined;
	const regCw = item.id ? context.registry?.cookware?.[item.id] : undefined;
	const isCookware = item.type === "cookware";
	const isRef = item.type === "reference";
	const name =
		item.alias ||
		item.name ||
		(isCookware ? regCw?.name : regIng?.name) ||
		item.id ||
		t.renderer.unknownIngredient;
	const prep = item.preparation || item.note;
	const kindClass = isCookware
		? "kit-cookware"
		: isRef
			? "kit-reference"
			: "kit-ingredient";

	let parentHtml = "";
	let parentDataAttr = "";
	if (item.parent) {
		const parentText = item.parentPreparation
			? `${item.parent}, ${item.parentPreparation}`
			: item.parent;
		const parentClass =
			options.classes?.compositeParentText || "composite-parent";
		parentHtml = ` <span class="${parentClass}">(${escapeHtml(parentText)})</span>`;
		parentDataAttr = ` data-parent="${escapeHtml(item.parent)}"`;
		if (item.parentPreparation) {
			parentDataAttr += ` data-parent-preparation="${escapeHtml(item.parentPreparation)}"`;
		}
	}

	const q = getQty(item);
	const itemQty = q
		? typeof q.value === "number"
			? q.value
			: q.text || item.quantity
		: item.quantity;

	// A piece of cookware shows how many you need as "×2", like the run sheet,
	// and nothing for one: needing a pan already means having one.
	const qtyContent = isCookware
		? itemQty && String(itemQty) !== "1"
			? `<span class="kit-mass">×${escapeHtml(String(itemQty))}</span>`
			: ""
		: kitQtyHtml(item, itemQty, t);

	const itemTypeClass = isCookware
		? "cookware"
		: isRef
			? "reference"
			: "ingredient";
	const refAttr =
		isRef && (item.id || item.name)
			? ` data-ref-id="${escapeHtml(item.id || item.name)}"`
			: "";

	let html = `        <li class="${kindClass}"><label><input type="checkbox"><span>`;
	html += `<span class="kit-name-col">`;
	html += `<span class="kit-name ${itemTypeClass}" data-name="${escapeHtml(item.name || item.id)}"${refAttr}${parentDataAttr}>${escapeHtml(name)}${parentHtml}</span>`;
	if (prep) {
		html += `<span class="kit-prep">${escapeHtml(prep)}</span>`;
	}
	html += `</span>`;
	if (qtyContent) {
		html += `<span class="kit-qty">${qtyContent}</span>`;
	}
	html += `</span></label></li>\n`;
	return html;
}

function renderKitAlternativeItem(
	item: KitItem,
	context: RenderContext,
	options: RendererOptions,
	forceCookware = false,
	showPrep = true,
): string {
	const t = getDictionary(options.lang);
	const isCookware = forceCookware || item.type === "cookware";
	const kindClass = isCookware ? "kit-cookware" : "kit-ingredient";
	const optClass = isCookware ? "cookware" : "ingredient";

	const opts = item.options || [];
	const optionsCols = opts
		.map((opt) => {
			const regOpt = opt.id
				? context.registry?.ingredients?.[opt.id]
				: undefined;
			const regCw = opt.id ? context.registry?.cookware?.[opt.id] : undefined;
			const rawName =
				opt.alias ||
				opt.name ||
				(isCookware ? regCw?.name : regOpt?.name) ||
				opt.id ||
				"";
			const optName = rawName.replace(/-/g, " ");
			const optPrep = opt.preparation || opt.note;
			const q = getQty(opt);
			const optQty = q
				? q.text ||
					(typeof q.value === "number"
						? String(q.value)
						: typeof opt.quantity === "number"
							? String(opt.quantity)
							: "")
				: "";
			let s = `<span class="${optClass}" data-name="${escapeHtml(optName)}">${escapeHtml(optName)}`;
			if (optQty) {
				s += ` <span class="quantity">${escapeHtml(String(optQty))}</span>`;
			}
			if (optPrep && showPrep) {
				s += ` <span class="prep">&mdash; ${escapeHtml(optPrep)}</span>`;
			}
			s += `</span>`;
			return s;
		})
		.join(` <span class="keyword">${escapeHtml(t.renderer.or)}</span> `);

	let qtyContent = "";
	const first = opts[0];
	if (first) {
		const q = getQty(first);
		const firstQty = q ? (q.value ?? first.quantity) : first.quantity;
		qtyContent = kitQtyHtml(first, firstQty, t, {
			isCookware,
			withBadges: false,
		});
	}

	let html = `        <li class="${kindClass}"><label><input type="checkbox"><span>`;
	html += `<span class="kit-name-col"><span class="alt-group">${optionsCols}</span></span>`;
	if (qtyContent) {
		html += `<span class="kit-qty">${qtyContent}</span>`;
	}
	html += `</span></label></li>\n`;
	return html;
}

/**
 * A part of a composite (the yolks of the eggs): an informative sub-line
 * under the item you buy, with no checkbox of its own — you buy eggs, not
 * yolks.
 */
function renderKitUsageItem(
	child: KitItem,
	parent: KitItem,
	context: RenderContext,
	t: Dictionary,
): string {
	// The compiler records using the parent itself whole as an entry of the
	// parent's own id (with an English "Direct Use" alias, never shown).
	// A stopgap until the compiled JSON marks direct use itself (planned with
	// the composites rework of 1.5).
	const isDirect = child.id === parent.id;
	const name = isDirect
		? t.renderer.directUse
		: child.alias ||
			child.name ||
			(child.id && context.registry?.ingredients?.[child.id]?.name) ||
			child.id;
	const q = getQty(child);
	const childQty = q
		? typeof q.value === "number"
			? q.value
			: q.text || child.quantity
		: child.quantity;
	const qtyContent = kitQtyHtml(child, childQty, t, { showBareCount: true });

	let html = `            <li class="kit-usage">`;
	html += `<span class="kit-usage-branch" aria-hidden="true">↳</span>`;
	html += `<span class="kit-usage-name">${escapeHtml(String(name))}</span>`;
	if (qtyContent) {
		html += `<span class="kit-usage-qty">${qtyContent}</span>`;
	}
	html += `</li>\n`;
	return html;
}

/**
 * A composite: one line, with one checkbox, for the item you buy (eggs),
 * followed by the parts the recipe uses (yolks, whites) as sub-lines.
 *
 * The parent shows its count only. Its `normalizedMass` is, for now, the sum
 * of its parts' masses (102 g of yolks), not the mass of what you buy (six
 * eggs): showing it here would be wrong. Each part shows its own mass.
 */
function renderKitCompositeItem(
	item: KitItem,
	context: RenderContext,
	options: RendererOptions,
): string {
	const t = getDictionary(options.lang);
	const unitStr = item.unit ? ` ${escapeHtml(item.unit)}` : "";
	const qtyContent =
		typeof item.qty === "number" && item.qty
			? `<span class="kit-mass">${escapeHtml(String(round1(item.qty)))}${unitStr}</span>`
			: "";

	// No `list-item-group` here: the parent row lays out like any other line
	// (dot leader included), and the copy button copies it as one line.
	let html = `        <li class="kit-ingredient kit-composite"><label><input type="checkbox"><span>`;
	html += `<span class="kit-name-col"><span class="kit-name">${escapeHtml(item.name || item.id)}</span></span>`;
	if (qtyContent) {
		html += `<span class="kit-qty">${qtyContent}</span>`;
	}
	html += `</span></label>\n`;
	const usage = item.usage || [];
	if (usage.length > 0) {
		html += `          <ul class="kit-usage-list">\n`;
		usage.forEach((child) => {
			html += renderKitUsageItem(child, item, context, t);
		});
		html += `          </ul>\n`;
	}
	html += `        </li>\n`;
	return html;
}

/**
 * The line under a step naming what it makes (`->&dough` → "↳ dough"). Each
 * name keeps its `data-declares`, so hovering a later reference to it still
 * finds this step.
 */
function renderStepResult(
	declItems: KitItem[],
	context: RenderContext,
	options: RendererOptions,
): string {
	const icon =
		options.icons?.arrowElbowDownRight ??
		DEFAULT_ICONS.html.arrowElbowDownRight;
	const declClass = options.classes?.declaration || "declaration";
	const names = declItems
		.map((item) => {
			const name =
				(item.id && context.registry?.ingredients?.[item.id]?.name) ||
				item.name ||
				"";
			const id = item.id || item.name;
			const attr = id ? ` data-declares="${escapeHtml(id)}"` : "";
			return `<span class="${declClass} step-result-item"${attr}>${escapeHtml(name)}</span>`;
		})
		.join(", ");
	return `<span class="step-result">${icon} ${names}</span>`;
}

/**
 * A mass as the hero bar and the section badges show it: "850g" when every
 * mass is known, "~850g" when some come from an average value of the
 * database, ">850g" when some are missing (the real mass is higher).
 */
function massLabel(metrics: Partial<MassMetrics>) {
	const mass = Math.round(metrics.totalMass ?? 0);
	if (metrics.massStatus === "incomplete") return `>${mass}g`;
	if (metrics.massStatus === "estimated") return `~${mass}g`;
	return `${mass}g`;
}

/**
 * The tooltip of a mass: what it measures, then why it is estimated or
 * incomplete. The ingredients converted with an average value of the
 * database come with how and how much; those with no mass at all, with what
 * to write to get one. Both can show together: the status keeps only the
 * worst ("incomplete"), the reader gets both.
 *
 * What counts is what the analyzer counts (`resolveContributingUsage`: no
 * optional ingredient, the first option of an alternative), so the lines add
 * up to the figure. Rich HTML in a `.timing-tooltip`, which the floating
 * tooltip script shows on hover (or CSS, without it).
 */
function massTooltipHtml(
	title: string,
	metrics: Partial<MassMetrics>,
	ingredients: AnalyzedUsage[],
	context: RenderContext,
	t: Dictionary,
): string {
	if (context.paper) return "";
	const estimated = new Map<string, { mass: number; methods: Set<string> }>();
	for (const item of ingredients) {
		const target = resolveContributingUsage(item);
		if (!target?.isEstimate || !target.normalizedMass) continue;
		const name = String(
			target.alias ||
				target.name ||
				context.registry?.ingredients?.[target.id]?.name ||
				target.id,
		);
		const entry = estimated.get(name) ?? { mass: 0, methods: new Set() };
		entry.mass += target.normalizedMass;
		if (target.conversionMethod === "density") {
			entry.methods.add(t.renderer.massMethodDensity);
		} else if (target.conversionMethod === "unit_weight") {
			entry.methods.add(t.renderer.massMethodUnitWeight);
		}
		estimated.set(name, entry);
	}
	// The analyzer lists an ingredient with no name of its own by its id
	// ("olives-vertes"): the registry has the name to show.
	const missing = [
		...new Set(
			(metrics.missingMassIngredients ?? []).map(
				(n) => context.registry?.ingredients?.[n]?.name || n,
			),
		),
	];

	const heading = (label: string, detail: string) =>
		`      <div class="timing-row"><span class="timing-label"><strong>${escapeHtml(label)}</strong> <span class="timing-detail-type">${escapeHtml(detail)}</span></span></div>`;
	const row = (name: string, detail: string, value: string) =>
		`      <div class="timing-row"><span class="timing-label">${escapeHtml(name)}${detail ? ` <span class="timing-detail-type">(${escapeHtml(detail)})</span>` : ""}</span><span class="timing-val">${escapeHtml(value)}</span></div>`;

	let html = `\n    <div class="timing-tooltip">`;
	html += `\n      <div class="timing-tooltip-title">${escapeHtml(title)}</div>`;
	if (estimated.size > 0) {
		html += `\n      <div class="timing-divider"></div>`;
		html += `\n${heading(t.renderer.massEstimated, t.renderer.massEstimatedDetail)}`;
		for (const [name, { mass, methods }] of estimated) {
			html += `\n${row(name, [...methods].join(", "), `~${round1(mass)} g`)}`;
		}
	}
	if (missing.length > 0) {
		html += `\n      <div class="timing-divider"></div>`;
		html += `\n${heading(t.renderer.massIncomplete, t.renderer.massIncompleteDetail)}`;
		for (const name of missing) {
			html += `\n${row(name, "", "?")}`;
		}
		html += `\n      <div class="timing-row"><span class="timing-label timing-detail-type">${escapeHtml(t.renderer.massIncompleteHint)}</span></div>`;
	}
	html += `\n    </div>`;
	return html;
}

function renderKitMixedUnitsItem(
	group: KitItem[],
	context: RenderContext,
	options: RendererOptions,
): string {
	const t = getDictionary(options.lang);
	const first = group[0];
	if (!first) return "";
	const name = first.name || first.id || "";
	let html = `        <li class="kit-ingredient list-item-group"><label><input type="checkbox"><span>`;
	html += `<span class="kit-name-col"><span class="kit-name">${escapeHtml(name)}</span> <span class="mixed-units-badge" data-tooltip="${escapeHtml(t.renderer.mixedUnitsTooltip)}">⚠️ ${escapeHtml(t.renderer.mixedUnits)}</span></span>`;
	html += `</span></label>`;
	html += `          <ul class="kit-list sub-kit-list">\n`;
	group.forEach((entry) => {
		html += renderKitItem(entry, context, options);
	});
	html += `          </ul>\n`;
	html += `        </li>\n`;
	return html;
}

/** The anchor of the nutrition table, which the hero bar's pill links to. */
function nutritionAnchor(options: RendererOptions): string {
	return `${options.renderId ?? "recipe"}-nutrition`;
}

/** Whether the nutrition has figures to show, not only warnings. */
function hasNutritionValues(nut: NutritionMetrics): boolean {
	return (nut.total?.calories ?? 0) > 0;
}

/**
 * The basis of the hero bar's pill: per portion, else per 100 g (a figure a
 * reader can compare, as on a package, where the whole recipe would only say
 * how big it is), else the whole recipe. Pinned by `nutritionBasis`.
 */
function pillBasis(
	nut: NutritionMetrics,
	options: RendererOptions,
): ResolvedBasis {
	if (options.nutritionBasis && options.nutritionBasis !== "auto") {
		return resolveNutritionBasis(nut, options.nutritionBasis, options.lang);
	}
	const bases = availableBases(nut, options.lang);
	return (
		bases.find((b) => b.key === "perPortion") ??
		bases.find((b) => b.key === "per100g") ??
		(bases[bases.length - 1] as ResolvedBasis)
	);
}

/** A nutrient's value with its unit: "22.1 g", "520 kcal". */
function nutrientValue(row: Pick<NutrientRow, "value" | "unit">): string {
	const value = row.unit === "kcal" ? Math.round(row.value) : row.value;
	return `${value} ${row.unit}`;
}

/** A basis label inside a sentence: "per portion", "pour 100 g". */
function inlineBasisLabel(basis: ResolvedBasis, lang?: string): string {
	return basis.label.toLocaleLowerCase(lang || "en");
}

export const htmlBackend: RenderBackend = {
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
			interactiveScaling: options.interactiveScaling,
			lang: options.lang,
			_inlineComments: [],
			_renderId: options.renderId ?? "note",
		};
	},

	renderTitle(data, _context, options) {
		if (!data.title) return "";
		const titleClass = options.classes?.recipeTitle
			? ` class="${options.classes.recipeTitle}"`
			: ' class="recipe-title"';
		let html = `<h1${titleClass}>${escapeHtml(data.title)}</h1>\n`;
		const desc = data.meta?.description;
		if (desc) {
			const descStr = Array.isArray(desc) ? desc.join(" ") : String(desc);
			const descClass = options.classes?.recipeDescription
				? ` class="${options.classes.recipeDescription}"`
				: ' class="recipe-description"';
			html += `<p${descClass}>${escapeHtml(descStr)}</p>\n`;
		}
		html += "\n";
		return html;
	},

	renderMeta(data, context, options) {
		const t = getDictionary(options.lang);
		const formatDuration = options.formatDuration || defaultFormatDuration;
		const metrics = data.metrics as RenderableMetrics;

		let html = "";
		const meta = data.meta || {};

		// 1. Byline (Auteur, Date, Source cliquable, Catégorie, Tags, Métadonnées libres)
		const bylineParts: string[] = [];

		if (meta.author) {
			const authorStr = Array.isArray(meta.author)
				? meta.author.join(", ")
				: String(meta.author);
			bylineParts.push(
				`<span class="byline-author">${escapeHtml(authorStr)}</span>`,
			);
		}
		if (meta.date) {
			bylineParts.push(
				`<span class="byline-date">${escapeHtml(String(meta.date))}</span>`,
			);
		}
		if (meta.source) {
			const src = String(meta.source);
			if (src.startsWith("http")) {
				const displayUrl = src
					.replace(/^https?:\/\/(www\.)?/, "")
					.replace(/\/.*$/, "");
				bylineParts.push(
					`<a class="byline-source" href="${escapeHtml(src)}" target="_blank" rel="noopener">${escapeHtml(displayUrl)}</a>`,
				);
			} else {
				bylineParts.push(
					`<span class="byline-source">${escapeHtml(src)}</span>`,
				);
			}
		}
		if (meta.category) {
			bylineParts.push(
				`<span class="byline-category">${escapeHtml(String(meta.category))}</span>`,
			);
		}
		if (Array.isArray(meta.tags) && meta.tags.length > 0) {
			bylineParts.push(
				`<span class="recipe-tags">${meta.tags.map((tag: string) => `<span class="gram-tag">${escapeHtml(tag)}</span>`).join(", ")}</span>`,
			);
		}

		// Métadonnées personnalisées du frontmatter
		const knownKeys = new Set([
			"title",
			"description",
			"author",
			"date",
			"source",
			"category",
			"tags",
			"portions",
			"servings",
			"makes",
			"yield",
			"yields",
			"notes",
			"densities",
		]);
		for (const [k, v] of Object.entries(meta)) {
			if (
				!knownKeys.has(k) &&
				!k.startsWith("_") &&
				v !== undefined &&
				v !== null &&
				v !== ""
			) {
				bylineParts.push(
					`<span class="byline-custom"><span class="label">${escapeHtml(k)}:</span> <span class="value">${escapeHtml(String(v))}</span></span>`,
				);
			}
		}

		if (bylineParts.length > 0) {
			html += `<div class="recipe-byline">${bylineParts.join('<span class="byline-sep">•</span>')}</div>\n`;
		}

		// 3. Barre des durées (Timings)
		if (metrics) {
			const SECTION_ACTIVE_PREFIX = "section_active:";
			const TIMER_NAMED_PREFIX = "timer_named:";

			const formatBreakdownHTML = (breakdown?: TimeBreakdownItem[]) => {
				if (!breakdown || breakdown.length === 0) return "";
				return breakdown
					.map((b) => {
						let label = b.label;
						if (label.startsWith(SECTION_ACTIVE_PREFIX)) {
							label = `${escapeHtml(label.slice(SECTION_ACTIVE_PREFIX.length))} <span class="timing-detail-type">(${t.renderer.breakdownActive})</span>`;
						} else if (label.startsWith(TIMER_NAMED_PREFIX)) {
							label = `${t.renderer.breakdownTimer} "${escapeHtml(label.slice(TIMER_NAMED_PREFIX.length))}"`;
						} else if (label === "timer_passive") {
							label = t.renderer.breakdownPassive;
						}

						return `      <div class="timing-row">
        <span class="timing-label">${label}</span>
        <span class="timing-val">+ ${formatDuration(b.duration)}</span>
      </div>`;
					})
					.join("\n");
			};

			const timingRow = (labelHtml: string, duration: number) =>
				`      <div class="timing-row">
        <span class="timing-label">${labelHtml}</span>
        <span class="timing-val">+ ${formatDuration(duration)}</span>
      </div>`;

			const sectionTitle = (index: number) =>
				data.sections[index]?.title || t.renderer.miseEnPlace;
			const miseSummaryRows = (data.miseEnPlace ?? [])
				.map((m) => timingRow(escapeHtml(sectionTitle(m.section)), m.duration))
				.join("\n");
			const miseDetailRows = (data.miseEnPlace ?? [])
				.map((m) =>
					[
						timingRow(
							`<strong>${escapeHtml(sectionTitle(m.section))}</strong>`,
							m.duration,
						),
						...m.items.map((item) =>
							timingRow(
								`<span class="timing-detail-type">${escapeHtml(
									describeMiseEnPlaceItem(
										item,
										data.registry,
										t.renderer,
										formatDuration,
										{ showDuration: false },
									),
								)}</span>`,
								item.duration,
							),
						),
					].join("\n"),
				)
				.join(`\n      <div class="timing-divider"></div>\n`);

			const renderTooltipHTML = (
				base?: string,
				breakdown?: TimeBreakdownItem[],
				rowsHtml?: string,
			) => {
				if (context.paper) return "";
				if (!base && !breakdown?.length && !rowsHtml) return "";

				let htmlStr = `\n    <div class="timing-tooltip">`;
				if (base) {
					htmlStr += `\n      <div class="timing-tooltip-title">${escapeHtml(base)}</div>`;
				}

				if (breakdown && breakdown.length > 0) {
					htmlStr += `\n${formatBreakdownHTML(breakdown)}`;
				}
				if (rowsHtml) htmlStr += `\n${rowsHtml}`;
				htmlStr += `\n    </div>`;
				return htmlStr;
			};

			const { totalTime, idleTime } = timesIn(context);
			const timingCardClass = options.classes?.timingCard
				? ` ${options.classes.timingCard}`
				: "";
			const metaValueClass = options.classes?.metaValue
				? ` ${options.classes.metaValue}`
				: "";

			const timingsBarClass =
				options.classes?.recipeTimingsBar || "recipe-timings-bar";
			html += `<div class="${timingsBarClass}">\n`;

			const clockIcon = options.icons?.clock ?? DEFAULT_ICONS.html.clock;
			const totalTooltip = renderTooltipHTML(
				t.renderer.totalTimeTooltip ?? t.renderer.totalTime,
				undefined,
				miseSummaryRows,
			);
			html += `  <span class="timing-pill total${timingCardClass}" data-tooltip="${escapeHtml(t.renderer.totalTime)}: ${formatDuration(totalTime)}">\n`;
			html += `    ${clockIcon} <span class="timing-text${metaValueClass}">${formatDuration(totalTime)}</span>${totalTooltip}\n`;
			html += `  </span>\n`;

			if (idleTime) {
				const idleTooltip = renderTooltipHTML(
					t.renderer.idleTimeTooltip ??
						"Idle Time = Total Time - Prep - Active",
				);
				html += `  <span class="timing-pill${timingCardClass}" data-tooltip="${escapeHtml(t.renderer.idleTime)}: ${formatDuration(idleTime)}">\n`;
				html += `    ${options.icons?.hourglass ?? DEFAULT_ICONS.html.hourglass} <span class="timing-text${metaValueClass}">${formatDuration(idleTime)} ${escapeHtml(t.renderer.idleTime.toLowerCase())}</span>${idleTooltip}\n`;
				html += `  </span>\n`;
			}

			const fireIcon = options.icons?.fire ?? DEFAULT_ICONS.html.fire;
			// @remove-in: 2.0.0 [renderer-active-breakdown-tooltip]
			const activeTooltip = renderTooltipHTML(
				t.renderer.activeTimeCardTooltip ?? t.renderer.activeTime,
				metrics.activeBreakdown,
			);
			html += `  <span class="timing-pill${timingCardClass}" data-tooltip="${escapeHtml(t.renderer.activeTime)}: ${formatDuration(metrics.activeTime)}">\n`;
			html += `    ${fireIcon} <span class="timing-text${metaValueClass}">${formatDuration(metrics.activeTime)} ${escapeHtml(t.renderer.activeTime.toLowerCase())}</span>${activeTooltip}\n`;
			html += `  </span>\n`;

			const knifeIcon = options.icons?.knife ?? DEFAULT_ICONS.html.knife;
			// The prep time is estimated from the mise en place, not written in the
			// recipe: "~", as for an estimated mass, and said in the tooltip.
			const prepTooltip = renderTooltipHTML(
				`${t.renderer.prepTimeTooltip ?? t.renderer.prepTime}${t.renderer.estimatedSuffix}`,
				undefined,
				miseDetailRows,
			);
			const metaEstClass = options.classes?.metaEst || "est";
			const prepDuration = formatDuration(metrics.preparationTime);
			html += `  <span class="timing-pill${timingCardClass}" data-tooltip="${escapeHtml(t.renderer.prepTime)}: ~${prepDuration}">\n`;
			html += `    ${knifeIcon} <span class="timing-text${metaValueClass}"><span class="${metaEstClass}">~</span>${prepDuration} ${escapeHtml(t.renderer.prepTime.toLowerCase())}</span>${prepTooltip}\n`;
			html += `  </span>\n`;

			html += `</div>\n`;
		}

		// 2. Hero Bar : Portions, Rendement, Masse nette totale
		let heroItemsHtml = "";

		// Portions: the number and its word, then, once the recipe is scaled,
		// the factor (and, interactive, a way back to the original). Nothing
		// of the scale shows on a recipe that is not scaled.
		const portionsVal = meta.portions ?? meta.servings;
		if (portionsVal !== undefined) {
			const numericV =
				typeof portionsVal === "number"
					? portionsVal
					: Number.parseFloat(String(portionsVal));
			const factor = data.scaleFactor;
			const isScaled =
				typeof factor === "number" && factor > 0 && Math.abs(factor - 1) > 1e-6;
			const unitHtml = escapeHtml(portionsUnit(portionsVal, options.lang));
			const usersIcon = options.icons?.users ?? DEFAULT_ICONS.html.users;
			const factorBadge = isScaled
				? `    <span class="scale-factor-badge" data-tooltip="${escapeHtml(t.renderer.scaledRecipe)}">${escapeHtml(formatScaleFactor(factor, options.lang))}</span>\n`
				: "";

			heroItemsHtml += `  <div class="hero-item hero-portions">\n`;
			heroItemsHtml += `    ${usersIcon}\n`;
			// @remove-in: 2.0.0 [renderer-interactive-scaling]
			if (options.interactiveScaling) {
				const basePortions =
					isScaled && !Number.isNaN(numericV)
						? round2(numericV / factor)
						: portionsVal;
				// Under one portion, "−" would only reach a fraction of one.
				const minusDisabled =
					!Number.isNaN(numericV) && numericV <= 1 ? " disabled" : "";
				const decLabel = escapeHtml(t.renderer.decreasePortions);
				const incLabel = escapeHtml(t.renderer.increasePortions);
				const editLabel = escapeHtml(t.renderer.editPortions);
				heroItemsHtml += `    <span class="scale-control interactive-portions" data-base-portions="${escapeHtml(String(basePortions))}">\n`;
				heroItemsHtml += `      <button type="button" class="scale-btn minus" data-scale-action="dec-portions" aria-label="${decLabel}" title="${decLabel}"${minusDisabled}>${options.icons?.minus ?? DEFAULT_ICONS.html.minus}</button>\n`;
				heroItemsHtml += `      <input type="number" class="scale-input-inline portions-input" value="${escapeHtml(String(portionsVal))}" min="0.1" step="any" inputmode="decimal" aria-label="${editLabel}" title="${editLabel}" />\n`;
				heroItemsHtml += `      <button type="button" class="scale-btn plus" data-scale-action="inc-portions" aria-label="${incLabel}" title="${incLabel}">${options.icons?.plus ?? DEFAULT_ICONS.html.plus}</button>\n`;
				heroItemsHtml += `    </span>\n`;
				heroItemsHtml += `    <span class="portions-unit">${unitHtml}</span>\n`;
				heroItemsHtml += factorBadge;
				if (isScaled) {
					const resetLabel = escapeHtml(
						`${t.renderer.originalRecipe} (${basePortions} ${portionsUnit(basePortions, options.lang)})`,
					);
					heroItemsHtml += `    <button type="button" class="scale-btn reset" data-scale-action="set-factor" data-value="1" aria-label="${resetLabel}" title="${resetLabel}">${RESET_SCALE_ICON}</button>\n`;
				}
			} else {
				heroItemsHtml += `    <span class="scale-val"><strong>${escapeHtml(String(portionsVal))}</strong> ${unitHtml}</span>\n`;
				heroItemsHtml += factorBadge;
				// A way to change the portions, for a surface that can (the
				// playground's settings): hidden by `screen.css` unless the
				// surface puts a `can-edit-portions` class around the view,
				// so an editor or an exported page shows no dead button.
				if (!context.paper) {
					const changeLabel = escapeHtml(t.renderer.changePortions);
					const pencilIcon =
						options.icons?.pencilSimple ?? DEFAULT_ICONS.html.pencilSimple;
					heroItemsHtml += `    <button type="button" class="edit-portions-btn" data-gram-action="edit-portions" aria-label="${changeLabel}" title="${changeLabel}">${pencilIcon}</button>\n`;
				}
			}
			heroItemsHtml += `  </div>\n`;
		}

		// What the recipe makes, weighs and brings, apart from the portions: a
		// group that goes to the next line as one when the bar is too narrow,
		// rather than one item at a time.
		let factsHtml = "";

		// Rendement (makes / yield)
		const makesVal = meta.makes ?? meta.yield ?? meta.yields;
		if (makesVal) {
			const packageIcon = options.icons?.package ?? DEFAULT_ICONS.html.package;
			factsHtml += `    <div class="hero-item hero-yield">\n`;
			factsHtml += `      ${packageIcon} <span>${escapeHtml(String(makesVal))}</span>\n`;
			factsHtml += `    </div>\n`;
		}

		// Total mass: the figure only, why it is estimated or incomplete in
		// its tooltip.
		if (metrics?.totalMass) {
			const scalesIcon = options.icons?.scales ?? DEFAULT_ICONS.html.scales;
			const tooltip = massTooltipHtml(
				t.renderer.massTitle,
				metrics,
				data.sections.flatMap((sec: any) => sec.ingredients ?? []),
				context,
				t,
			);
			factsHtml += `    <div class="hero-item hero-mass has-rich-tooltip">\n`;
			factsHtml += `      ${scalesIcon} <span class="mass-value">${escapeHtml(massLabel(metrics))}</span>${tooltip}\n`;
			factsHtml += `    </div>\n`;
		}

		// Nutrition: the energy of one basis, a link to the table at the bottom
		// of the recipe. Shown with the table (`show-macros`), never without it.
		const nut = metrics?.nutrition;
		if (nut && hasNutritionValues(nut)) {
			const basis = pillBasis(nut, options);
			const pieIcon = options.icons?.chartPie ?? DEFAULT_ICONS.html.chartPie;
			const kcal = Math.round(basis.values.calories ?? 0);
			factsHtml += `    <a class="hero-item hero-nutrition" href="#${escapeHtml(nutritionAnchor(options))}">\n`;
			factsHtml += `      ${pieIcon} <span class="nut-pill-value">${kcal} kcal</span> <span class="nut-pill-basis">${escapeHtml(inlineBasisLabel(basis, options.lang))}</span>\n`;
			factsHtml += `    </a>\n`;
		}

		if (factsHtml) {
			heroItemsHtml += `  <div class="hero-facts">\n${factsHtml}  </div>\n`;
		}

		if (heroItemsHtml.length > 0) {
			const heroBarClass = options.classes?.recipeHeroBar || "recipe-hero-bar";
			html += `<div class="${heroBarClass}">\n${heroItemsHtml}</div>\n`;
		}

		// 4. Note globale de recette (`notes:` du frontmatter)
		if (meta.notes) {
			const infoIcon = options.icons?.info ?? DEFAULT_ICONS.html.info;
			html += `<div class="recipe-note">\n`;
			html += `  ${infoIcon}\n`;
			html += `  <div>${escapeHtml(String(meta.notes))}</div>\n`;
			html += `</div>\n`;
		}

		html += `\n`;
		return html;
	},

	renderShoppingList(data, context, options) {
		const shoppingItems = (data.shopping_list ?? []) as KitItem[];
		const cookwareItems = (data.cookware ?? []) as KitItem[];

		if (shoppingItems.length === 0 && cookwareItems.length === 0) return "";
		const t = getDictionary(options.lang);

		let html = "";
		const shoppingListClass = options.classes?.shoppingList || "shopping-list";
		const hasBoth = shoppingItems.length > 0 && cookwareItems.length > 0;
		const title = hasBoth
			? `${escapeHtml(t.renderer.shoppingList)} &amp; ${escapeHtml(t.renderer.cookware)}`
			: shoppingItems.length > 0
				? escapeHtml(t.renderer.shoppingList)
				: escapeHtml(t.renderer.cookware);

		const copyIcon = options.icons?.copy ?? DEFAULT_ICONS.html.copy;
		const checkIcon = options.icons?.check ?? DEFAULT_ICONS.html.check;
		// Nothing to copy from paper.
		const copyBtnHtml = context.paper
			? ""
			: `<button type="button" class="copy-shopping-btn" aria-label="${escapeHtml(t.renderer.copyShoppingList)}" data-copied-text="${escapeHtml(t.renderer.copied)}"><span class="copy-icon">${copyIcon}</span><span class="check-icon" style="display:none">${checkIcon}</span> <span class="copy-label">${escapeHtml(t.renderer.copyShoppingList)}</span></button>`;

		html += `<details class="prep-accordion ${shoppingListClass}" open>\n`;
		html += `  <summary class="prep-summary">\n`;
		html += `    <span class="prep-summary-title">${title}</span>\n`;
		if (!hasBoth && copyBtnHtml) {
			html += `    ${copyBtnHtml}\n`;
		}
		html += `  </summary>\n`;
		html += `  <div class="prep-body">\n`;

		if (shoppingItems.length > 0) {
			html += `    <div class="mep-group">\n`;
			if (hasBoth) {
				html += `      <div class="mep-group-header">\n`;
				html += `        <h5 class="mep-group-title">${escapeHtml(t.renderer.shoppingList)}</h5>\n`;
				if (copyBtnHtml) html += `        ${copyBtnHtml}\n`;
				html += `      </div>\n`;
			}
			html += `      <ul class="kit-list">\n`;
			const groups = groupMultiUnitEntries(shoppingItems);
			groups.forEach((group) => {
				const item = group[0];
				if (!item) return;
				if (isAlternativeGroup(item)) {
					html += renderKitAlternativeItem(
						item,
						context,
						options,
						false,
						false,
					);
				} else if (isCompositeItem(item)) {
					html += renderKitCompositeItem(item, context, options);
				} else if (group.length > 1) {
					html += renderKitMixedUnitsItem(group, context, options);
				} else {
					html += renderKitItem(item, context, options);
				}
			});
			html += `      </ul>\n`;
			html += `    </div>\n`;
		}

		if (hasBoth && cookwareItems.length > 0) {
			html += `    <div class="mep-group">\n`;
			html += `      <h5 class="mep-group-title">${escapeHtml(t.renderer.cookware)}</h5>\n`;
			html += `      <ul class="kit-list">\n`;
			cookwareItems.forEach((cw) => {
				const cwItem = { ...cw, type: "cookware" };
				if (isAlternativeGroup(cw)) {
					html += renderKitAlternativeItem(
						cwItem,
						context,
						options,
						true,
						false,
					);
				} else {
					html += renderKitItem(cwItem, context, options);
				}
			});
			html += `      </ul>\n`;
			html += `    </div>\n`;
		}

		html += `  </div>\n`;
		html += `</details>\n\n`;
		return html;
	},

	renderCookware(data, context, options) {
		// When shopping list is already present, cookware was rendered together inside it
		if (data.shopping_list && data.shopping_list.length > 0) return "";
		if (!data.cookware || data.cookware.length === 0) return "";
		const t = getDictionary(options.lang);

		let html = "";
		const cookwareListClass = options.classes?.cookwareList || "cookware";
		html += `<details class="prep-accordion ${cookwareListClass}" open>\n`;
		html += `  <summary class="prep-summary">\n`;
		html += `    <span class="prep-summary-title">${escapeHtml(t.renderer.cookware)}</span>\n`;
		html += `  </summary>\n`;
		html += `  <div class="prep-body">\n`;
		html += `    <div class="mep-group">\n`;
		html += `      <ul class="kit-list">\n`;
		data.cookware.forEach((cw: any) => {
			const cwItem = { ...cw, type: "cookware" };
			if (isAlternativeGroup(cw)) {
				html += renderKitAlternativeItem(cwItem, context, options, true, false);
			} else {
				html += renderKitItem(cwItem, context, options);
			}
		});
		html += `      </ul>\n`;
		html += `    </div>\n`;
		html += `  </div>\n`;
		html += `</details>\n\n`;
		return html;
	},

	renderInstructions(data, context, options) {
		if (!data.sections || data.sections.length === 0) return "";
		const t = getDictionary(options.lang);
		// Context variant used when rendering inline step tokens — hides qty if flag is set
		// (not from shopping list or section mise en place, matches print.ts's stepContext).
		const stepContext: RenderContext = options.hideStepQty
			? { ...context, hideIngredientQty: true }
			: context;

		let html = "";
		const instructionsClass = options.classes?.instructions || "instructions";
		html += `<div class="${instructionsClass}">\n`;
		data.sections.forEach((sec: any) => {
			html += `  <section>\n`;

			if (sec.title) {
				let titleHtml = escapeHtml(sec.title);
				if (sec.retro_planning) {
					const rIcon =
						options.icons?.clockCounterClockwise ??
						DEFAULT_ICONS.html.clockCounterClockwise;
					titleHtml += ` <small class="section-meta-badge section-meta-retroplanning">${rIcon} ${escapeHtml(sec.retro_planning.raw)}</small>`;
				}

				// Section Mass
				if (sec.metrics && sec.metrics.totalMass > 0) {
					const sIcon = options.icons?.scales ?? DEFAULT_ICONS.html.scales;
					const tooltip = massTooltipHtml(
						t.renderer.massSectionTitle,
						sec.metrics,
						sec.ingredients ?? [],
						context,
						t,
					);
					titleHtml += ` <small class="section-meta-badge section-meta-mass has-rich-tooltip">${sIcon} ${escapeHtml(massLabel(sec.metrics))}${tooltip}</small>`;
				}

				const declLabel = sec.intermediate_preparation
					? intermediateLabel(
							context.registry?.ingredients ?? {},
							sec.intermediate_preparation,
						)
					: "";
				const declId = sec.intermediate_preparation
					? (context.registry?.ingredients?.[sec.intermediate_preparation]
							?.id ??
						Object.keys(context.registry?.ingredients ?? {}).find(
							(id) =>
								id === sec.intermediate_preparation ||
								context.registry?.ingredients?.[id]?.name ===
									sec.intermediate_preparation ||
								id === sec.intermediate_preparation.replace(/\$/g, "-"),
						) ??
						sec.intermediate_preparation.replace(/\$/g, "-"))
					: "";
				const declAttr = declId ? ` data-declares="${escapeHtml(declId)}"` : "";

				if (sec.intermediate_preparation && sec.module) {
					const arrowIcon =
						options.icons?.arrowRight ?? DEFAULT_ICONS.html.arrowRight;
					const packageIcon =
						options.icons?.package ?? DEFAULT_ICONS.html.package;
					titleHtml += ` <span class="section-declaration-badge has-module"${declAttr} data-tooltip="${escapeHtml(t.renderer.intermediateResult)}"><span class="section-module-source">${packageIcon} ${escapeHtml(moduleLabel(sec.module))}</span><span class="section-decl-target">${arrowIcon} ${escapeHtml(declLabel)}</span></span>`;
				} else if (sec.intermediate_preparation) {
					const arrowIcon =
						options.icons?.arrowRight ?? DEFAULT_ICONS.html.arrowRight;
					titleHtml += ` <span class="section-declaration-badge"${declAttr} data-tooltip="${escapeHtml(t.renderer.intermediateResult)}">${arrowIcon} ${escapeHtml(declLabel)}</span>`;
				} else if (sec.module) {
					const packageIcon =
						options.icons?.package ?? DEFAULT_ICONS.html.package;
					titleHtml += ` <small class="section-meta-badge section-meta-module" data-tooltip="${escapeHtml(t.renderer.moduleFrom)}">${packageIcon} ${escapeHtml(moduleLabel(sec.module))}</small>`;
				}

				const sHeaderClass = options.classes?.sectionHeader
					? ` ${options.classes.sectionHeader}`
					: "";
				html += `    <h3 class="section-header${sHeaderClass}"${declAttr}>${titleHtml}</h3>\n`;
			}

			// Section Ingredients — aggregated to remove duplicates and apply addition/segregation rules
			const sectionItems = aggregateSectionIngredients(
				sec.ingredients ?? [],
			).map(aggToRendererItem);

			if (sectionItems.length > 0) {
				const sIngredientsClass =
					options.classes?.sectionIngredients || "section-ingredients";
				html += `    <div class="${sIngredientsClass}">\n`;
				html += `      <ul class="kit-list">\n`;
				sectionItems.forEach((item: any) => {
					if (isAlternativeGroup(item)) {
						html += renderKitAlternativeItem(item, context, options);
					} else {
						html += renderKitItem(item, context, options);
					}
				});
				html += `      </ul>\n`;
				html += `    </div>\n`;
			}

			const stepsListClass = options.classes?.stepsList || "steps";
			html += `    <ol class="${stepsListClass}">\n`;
			let stepCounter = 0;
			sec.steps.forEach((step: any) => {
				if (step.type === "comment") {
					const stepCommentClass = options.classes?.stepComment
						? ` class="${options.classes.stepComment}"`
						: ' class="step-comment"';
					const icon = options.icons?.info ?? DEFAULT_ICONS.html.info;
					html += `      <li${stepCommentClass}>\n`;
					html += `        <span class="comment-icon">${icon}</span>\n`;
					html += `        <span class="comment-text">${escapeHtml(step.value)}</span>\n`;
					html += `      </li>\n`;
					return;
				}

				stepCounter++;
				const stepItemClass = options.classes?.stepItem
					? ` class="${options.classes.stepItem}"`
					: "";

				const declItems = step.content.filter(
					(c: any) => c.type === "declaration",
				);
				const declIds = declItems
					.map((c: any) => c.id || c.name)
					.filter(Boolean);
				const stepDeclAttr =
					declIds.length > 0
						? ` data-declares="${escapeHtml(declIds.join(" "))}"`
						: "";

				html += `      <li value="${stepCounter}"${stepDeclAttr}${stepItemClass}>\n`;
				if (step.action) {
					const stepActionClass = options.classes?.stepAction
						? ` class="${options.classes.stepAction}"`
						: ' class="action"';
					html += `        <span${stepActionClass}>${escapeHtml(step.action)}</span> `;
				}

				// What a step makes (`->&dough`) is not part of its sentence: it is
				// the step's result, written on a line of its own under the text,
				// whatever its position in the source (html.ts-specific choice — the
				// other formatters render declarations inline, in source order).
				const inlineItems = step.content.filter(
					(c: any) => c.type !== "declaration",
				);
				const stepContent = joinStepTokens(
					trimBeforeComments(inlineItems),
					(c) => formatElement(c, "html", stepContext),
					(c) => typeof c !== "string" && c.type !== "comment",
					nobr,
				);
				html += `        ${stepContent}\n`;
				if (declItems.length > 0) {
					html += `        ${renderStepResult(declItems, context, options)}\n`;
				}
				html += `      </li>\n`;
			});
			html += `    </ol>\n`;
			html += `  </section>\n`;
		});
		html += `</div>\n`;
		return html;
	},

	renderFootnotes(_data, context, options) {
		if (!context._inlineComments || context._inlineComments.length === 0) {
			return "";
		}
		const t = getDictionary(options.lang);
		const renderId = context._renderId || "note";
		let html = "";
		html += `<div class="recipe-notes">\n`;
		html += `  <h3>${t.renderer.notes}</h3>\n`;
		html += `  <ol>\n`;
		context._inlineComments.forEach((note, idx) => {
			const index = idx + 1;
			html += `    <li id="${renderId}-${index}">\n`;
			// The non-breaking space keeps ↩ on the line of the note's last word.
			html += `      ${escapeHtml(note)}&nbsp;<a href="#ref-${renderId}-${index}" class="note-return" title="${escapeHtml(t.renderer.returnToStep)}">↩</a>\n`;
			html += `    </li>\n`;
		});
		html += `  </ol>\n`;
		html += `</div>\n`;
		return html;
	},

	renderNutrition(data, _context, options) {
		const t = getDictionary(options.lang);
		const nut = getMetrics(data)?.nutrition;
		if (!hasNutritionToShow(nut) || !nut) return "";

		// A European label set like an American one: the columns of the first
		// (per 100 g, per portion, the share of the reference intake of a
		// portion, kJ and kcal), the rhythm of the second (a strong title,
		// heavy rules between header, energy and nutrients, the energy in
		// large type). Every basis side by side, so no switch is needed (and
		// none was possible without a script in the standalone file of
		// `gram export`).
		const columns = nutritionColumns(nut, options.nutritionBasis, options.lang);
		const riBasis = columns.find((c) => c.key === "perPortion");
		const rowsByColumn = columns.map((c) =>
			nutritionRows(c.values, options.lang),
		);
		const riRows = riBasis ? nutritionRows(riBasis.values, options.lang) : [];
		const kcalOf = (basis: ResolvedBasis) =>
			Math.round(basis.values.calories ?? 0);
		const riCell = (key: string) => {
			if (!riBasis) return "";
			const row = riRows.find((r) => r.key === key);
			const pct = row ? referenceIntakePercent(key, row.value) : undefined;
			return `<td class="nut-ri">${pct === undefined ? "" : `${pct}%`}</td>`;
		};

		let html = "";
		html += `<section class="nutrition-panel" id="${escapeHtml(nutritionAnchor(options))}">\n`;
		html += `  <div class="nut-header"><h3 class="nut-title">${escapeHtml(t.renderer.nutritionTableTitle)}</h3> <span class="est-badge" data-tooltip="${escapeHtml(t.renderer.coverageTooltip)}: ${Math.round(nut.coverage * 100)}%">${escapeHtml(t.renderer.estimateTooltip)}</span></div>\n`;

		// What the figures rest on: the portions, the raw mass.
		const subtitle = [
			riBasis ? portionsLabel(data, options.lang) : undefined,
			columns.find((c) => c.note)?.note,
		].filter(Boolean);
		if (subtitle.length > 0 && hasNutritionValues(nut)) {
			html += `  <p class="nut-subtitle">${escapeHtml(subtitle.join(" · "))}</p>\n`;
		}

		for (const w of nut.warnings ?? []) {
			html += `  <p class="nut-warnings"><strong>${escapeHtml(t.renderer.incompleteData)}:</strong> ${escapeHtml(w.message)}</p>\n`;
		}

		if (!hasNutritionValues(nut)) {
			html += `</section>\n`;
			return html;
		}

		// The table scrolls inside its frame when the view is too narrow for
		// it, rather than pushing the page wider.
		html += `  <div class="nut-table-scroll">\n`;
		html += `  <table class="nut-table">\n`;
		html += `    <thead><tr><th scope="col" class="nut-col-name"><span class="nut-sr">${escapeHtml(t.renderer.nutritionNutrient)}</span></th>`;
		for (const c of columns) {
			html += `<th scope="col">${escapeHtml(c.label)}</th>`;
		}
		if (riBasis) {
			html += `<th scope="col" class="nut-col-ri">${escapeHtml(t.renderer.nutritionReferenceIntake)}*</th>`;
		}
		html += `</tr></thead>\n`;
		html += `    <tbody>\n`;

		// The energy: kcal in large type over kJ, in every column.
		html += `      <tr class="nut-energy"><th scope="row">${escapeHtml(t.renderer.nutrients.calories)}</th>`;
		for (const c of columns) {
			const kcal = kcalOf(c);
			html += `<td><span class="nut-kcal">${kcal} kcal</span><span class="nut-kj">${kcalToKj(kcal)} kJ</span></td>`;
		}
		html += riCell("calories");
		html += `</tr>\n`;

		for (const row of rowsByColumn[0] ?? []) {
			if (row.key === "calories") continue;
			const cls = row.nested ? ' class="is-nested"' : "";
			html += `      <tr${cls}><th scope="row">${escapeHtml(row.label)}</th>`;
			for (const rows of rowsByColumn) {
				const cell = rows.find((r) => r.key === row.key);
				html += `<td>${cell ? escapeHtml(nutrientValue(cell)) : ""}</td>`;
			}
			html += riCell(row.key);
			html += `</tr>\n`;
		}
		html += `    </tbody>\n`;
		html += `  </table>\n`;
		html += `  </div>\n`;

		// Under the table: the whole recipe when it is not a column, then the
		// reference intake.
		const notes: string[] = [];
		const total = wholeRecipeBelow(nut, columns, options.lang);
		if (total) {
			notes.push(
				`<span class="nut-total">${escapeHtml(t.renderer.nutritionWholeRecipeTotal.replace("{kcal}", `${kcalToKj(kcalOf(total))} kJ / ${kcalOf(total)} kcal`))}</span>`,
			);
		}
		if (riBasis) {
			notes.push(`* ${escapeHtml(t.renderer.nutritionReferenceIntakeNote)}`);
		}
		if (notes.length > 0) {
			html += `  <div class="nut-footer">\n`;
			for (const note of notes) html += `    <p>${note}</p>\n`;
			html += `  </div>\n`;
		}

		html += `</section>\n`;
		return html;
	},

	assembleDocument(sections: RenderSections) {
		// The root every rule of `screen.css` is scoped to.
		return (
			'<article class="gram-recipe">\n' +
			sections.title +
			sections.meta +
			sections.shoppingList +
			sections.cookware +
			sections.instructions +
			sections.footnotes +
			sections.nutrition +
			"</article>\n"
		);
	},
};

export function toHTML(
	data: RenderableCompilationResult,
	options: RendererOptions = {},
): string {
	return renderRecipe(data, options, htmlBackend);
}

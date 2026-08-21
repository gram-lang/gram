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
	availableBases,
	getMetrics,
	hasNutritionToShow,
	nutritionGroups,
	resolveNutritionBasis,
} from "../nutrition";
import { formatElement } from "./element";
import { moduleLabel } from "./shared";
import {
	aggregateSectionIngredients,
	round2,
	type TimeBreakdownItem,
} from "@gram-lang/kitchen";
import { getDictionary } from "@gram-lang/i18n";

const htmlBackend: RenderBackend = {
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
			: "";
		return `<h1${titleClass}>${escapeHtml(data.title)}</h1>\n\n`;
	},

	renderMeta(data, _context, options) {
		const t = getDictionary(options.lang);
		const registry = data.registry || { ingredients: {}, cookware: {} };
		const formatDuration = options.formatDuration || defaultFormatDuration;
		// See RenderableMetrics's own comment: a plain (un-analyzed) compile()
		// result's `metrics` never carries mass/nutrition fields at all.
		const metrics = data.metrics as RenderableMetrics;

		let html = "";

		// RendererOptions.classes.recipeMeta/metaItem/metaIcon/metaContent are still
		// accepted for backwards compatibility but apply to nothing below — this
		// markup was restructured around timing cards without updating them.
		const metaLabelClass = options.classes?.metaLabel || "meta-label";
		const metaValueClass = options.classes?.metaValue || "meta-value";
		const metaEstClass = options.classes?.metaEst || "est";

		const timingsGridClass =
			options.classes?.recipeTimingsGrid || "recipe-timings-grid";
		const timingCardClass = options.classes?.timingCard || "timing-card";

		html += `<div class="${timingsGridClass}">\n`;
		if (metrics) {
			// Prefixes used by kitchen's TimeBreakdownItem labels (processor.ts /
			// metrics.ts) — kept as named constants and sliced by their own
			// `.length` so a label check can never silently drift out of sync with
			// the slice that strips it.
			const SECTION_ACTIVE_PREFIX = "section_active:";
			const TIMER_NAMED_PREFIX = "timer_named:";
			const PREP_PREFIX = "prep_";

			const formatBreakdownHTML = (breakdown?: TimeBreakdownItem[]) => {
				if (!breakdown || breakdown.length === 0) return "";
				return breakdown
					.map((b) => {
						let label = b.label;
						if (label.startsWith(SECTION_ACTIVE_PREFIX)) {
							// The section title and timer name here come straight from
							// recipe source text (`## <title>`, `~<name>{...}`) — must be
							// escaped, or a recipe author can inject HTML into the
							// playground/VS Code preview.
							label = `${escapeHtml(label.slice(SECTION_ACTIVE_PREFIX.length))} <span class="timing-detail-type">(${t.renderer.breakdownActive})</span>`;
						} else if (label.startsWith(TIMER_NAMED_PREFIX)) {
							label = `${t.renderer.breakdownTimer} "${escapeHtml(label.slice(TIMER_NAMED_PREFIX.length))}"`;
						} else if (label === "timer_passive") {
							label = t.renderer.breakdownPassive;
						} else if (label === "ingredients_overhead") {
							label = `${t.renderer.ingredientsOverhead} <span class="timing-detail-type">(${b.duration} x 1min)</span>`;
						} else if (label === "cookware_overhead") {
							label = `${t.renderer.cookwareOverhead} <span class="timing-detail-type">(${b.duration} x 1min)</span>`;
						} else if (label.startsWith(PREP_PREFIX)) {
							const id = label.slice(PREP_PREFIX.length);
							const name =
								registry.ingredients?.[id]?.name ??
								registry.cookware?.[id]?.name ??
								id;
							label = `${t.renderer.breakdownPrep} : ${escapeHtml(name)} <span class="timing-detail-type">(+ 2min)</span>`;
						}

						return `      <div class="timing-row">
        <span class="timing-label">${label}</span>
        <span class="timing-val">+ ${formatDuration(b.duration)}</span>
      </div>`;
					})
					.join("\n");
			};

			const renderTooltipHTML = (
				base?: string,
				breakdown1?: TimeBreakdownItem[],
				breakdown2?: TimeBreakdownItem[],
			) => {
				if (!base && !breakdown1?.length && !breakdown2?.length) return "";

				let htmlStr = `\n    <div class="timing-tooltip">`;
				if (base) {
					htmlStr += `\n      <div class="timing-tooltip-title">${escapeHtml(base)}</div>`;
				}

				if (breakdown1 && breakdown1.length > 0) {
					htmlStr += "\n" + formatBreakdownHTML(breakdown1);
				}
				if (breakdown2 && breakdown2.length > 0) {
					if (breakdown1 && breakdown1.length > 0) {
						htmlStr += `\n      <div class="timing-divider"></div>`;
					}
					htmlStr += "\n" + formatBreakdownHTML(breakdown2);
				}
				htmlStr += `\n    </div>`;
				return htmlStr;
			};

			const clockIcon = options.icons?.clock ?? '<i class="ph ph-clock"></i>';
			const totalTooltip = renderTooltipHTML(
				t.renderer.totalTimeTooltip ?? t.renderer.totalTime,
				metrics.prepBreakdown,
				metrics.totalBreakdown,
			);
			html += ` <div class="${timingCardClass}">\n`;
			html += `   <div class="${metaLabelClass}">${clockIcon} ${t.renderer.totalTime}</div>\n`;
			html += `   <div class="${metaValueClass}">${formatDuration(metrics.totalTime)}</div>${totalTooltip}\n`;
			html += ` </div>\n`;

			if (metrics.idleTime) {
				const idleTooltip = renderTooltipHTML(
					t.renderer.idleTimeTooltip ??
						"Idle Time = Total Time - Prep - Active",
				);
				html += ` <div class="${timingCardClass}">\n`;
				html += `   <div class="${metaLabelClass}">${options.icons?.hourglass ?? '<i class="ph ph-hourglass-high"></i>'} ${t.renderer.idleTime}</div>\n`;
				html += `   <div class="${metaValueClass}">${formatDuration(metrics.idleTime)}</div>${idleTooltip}\n`;
				html += ` </div>\n`;
			}

			const fireIcon = options.icons?.fire ?? '<i class="ph ph-fire"></i>';
			const activeTooltip = renderTooltipHTML(
				t.renderer.activeTimeCardTooltip ?? t.renderer.activeTime,
				metrics.activeBreakdown,
			);
			html += ` <div class="${timingCardClass}">\n`;
			html += `   <div class="${metaLabelClass}">${fireIcon} ${t.renderer.activeTime}</div>\n`;
			html += `   <div class="${metaValueClass}">${formatDuration(metrics.activeTime)}</div>${activeTooltip}\n`;
			html += ` </div>\n`;

			const knifeIcon = options.icons?.knife ?? '<i class="ph ph-knife"></i>';
			const prepTooltip = renderTooltipHTML(
				t.renderer.prepTimeTooltip ?? t.renderer.prepTime,
				metrics.prepBreakdown,
			);
			html += ` <div class="${timingCardClass}">\n`;
			html += `   <div class="${metaLabelClass}">${knifeIcon} ${t.renderer.prepTime}</div>\n`;
			html += `   <div class="${metaValueClass}">${formatDuration(metrics.preparationTime)} <span class="${metaEstClass}">${t.renderer.est}</span></div>${prepTooltip}\n`;
			html += ` </div>\n`;
		}
		html += `</div>\n`;

		const recipeMetaSecondaryClass =
			options.classes?.recipeMetaSecondary || "recipe-meta-secondary";
		const metadataGridClass = options.classes?.metadataGrid || "metadata-grid";
		const metaSecondaryItemClass =
			options.classes?.metaSecondaryItem || "meta-secondary-item";

		html += `<div class="${recipeMetaSecondaryClass}">\n`;
		html += `<div class="${metadataGridClass}">\n`;

		if (metrics?.totalMass) {
			const mass = Math.round(metrics.totalMass);
			let msg = `${mass}g`;
			if (metrics.massStatus === "estimated") {
				msg = `~${mass}g (Estimated)`;
			}
			if (metrics.massStatus === "incomplete") {
				msg = `>${mass}g (Incomplete)`;
			}
			html += `  <div class="${metaSecondaryItemClass}">\n`;
			html += `    <span class="label">Total Mass</span>\n`;
			html += `    <span class="value">${msg}</span>\n`;
			html += `  </div>\n`;
		}

		if (data.meta) {
			for (const [k, v] of Object.entries(data.meta)) {
				if (k !== "title") {
					html += `  <div class="${metaSecondaryItemClass}">\n`;
					html += `    <span class="label">${escapeHtml(k)}</span>\n`;
					if (k === "portions" && options.interactiveScaling) {
						const numericV = typeof v === "number" ? v : parseFloat(String(v));
						const basePortions =
							typeof data.scaleFactor === "number" &&
							data.scaleFactor !== 0 &&
							!Number.isNaN(numericV)
								? round2(numericV / data.scaleFactor)
								: v;
						html += `    <span class="value interactive-portions" data-base-portions="${escapeHtml(String(basePortions))}">\n`;
						html += `      <button class="scale-btn minus" data-scale-action="dec-portions" title="${escapeHtml(t.renderer.decreasePortions)}">${options.icons?.minus ?? '<i class="ph ph-minus"></i>'}</button>\n`;
						html += `      <input type="number" class="scale-input-inline portions-input" value="${escapeHtml(String(v))}" min="0.1" step="any" title="${escapeHtml(t.renderer.editPortions)}" />\n`;
						html += `      <button class="scale-btn plus" data-scale-action="inc-portions" title="${escapeHtml(t.renderer.increasePortions)}">${options.icons?.plus ?? '<i class="ph ph-plus"></i>'}</button>\n`;
						html += `      <span class="scale-multipliers">\n`;
						html += `        <button class="scale-btn factor reset" data-scale-action="set-factor" data-value="1" title="${escapeHtml(t.renderer.originalRecipe)}">${escapeHtml(t.renderer.reset)}</button>\n`;
						html += `      </span>\n`;
						html += `    </span>\n`;
					} else if (!k.startsWith("_")) {
						html += `    <span class="value">${escapeHtml(String(v))}</span>\n`;
					}
					html += `  </div>\n`;
				}
			}
		}

		html += `</div>\n`;
		html += `</div>\n\n`;

		return html;
	},

	renderShoppingList(data, context, options) {
		if (!data.shopping_list || data.shopping_list.length === 0) return "";
		const t = getDictionary(options.lang);

		let html = "";
		const shoppingListClass = options.classes?.shoppingList || "shopping-list";
		html += `<details class="${shoppingListClass}">\n`;
		html += `  <summary><h2>${t.renderer.shoppingList}</h2></summary>\n`;
		html += `  <ul>\n`;

		const shoppingItems: any[] = data.shopping_list;
		const renderGroups = groupMultiUnitEntries(shoppingItems);

		renderGroups.forEach((group) => {
			const item = group[0];
			if (isAlternativeGroup(item)) {
				// strategies.alternative already joins every option ("egg or egg
				// substitute") on one line — reuse it instead of hand-rolling the
				// same join as a nested sub-list.
				html += `    <li>${formatElement(item, "html", { ...context, formatMode: "shopping-list" })}</li>\n`;
			} else if (isCompositeItem(item)) {
				html += `    <li class="list-item-group">\n`;
				html += `      ${formatElement(item, "html", { ...context, formatMode: "shopping-list" })} <strong>(Composite)</strong>:\n`;
				html += `      <ul>\n`;
				item.usage.forEach((child: any) => {
					html += `        <li>${formatElement(child, "html", { ...context, formatMode: "shopping-list" })}</li>\n`;
				});
				html += `      </ul>\n`;
				html += `    </li>\n`;
			} else if (item.display) {
				html += `    <li>${escapeHtml(item.display)}</li>\n`;
			} else if (group.length > 1) {
				html += `    <li class="list-item-group">\n`;
				html += `      <strong>${escapeHtml(item.name || item.id)}</strong> <span class="mixed-units-badge" data-tooltip="${escapeHtml(t.renderer.mixedUnitsTooltip)}">⚠️ ${escapeHtml(t.renderer.mixedUnits)}</span>:\n`;
				html += `      <ul>\n`;
				group.forEach((entry: any) => {
					html += `        <li>${formatElement(entry, "html", { ...context, formatMode: "shopping-list" })}</li>\n`;
				});
				html += `      </ul>\n`;
				html += `    </li>\n`;
			} else {
				let extraHtml = "";
				if (
					item.purchasingMass &&
					item.purchasingMass !== item.normalizedMass
				) {
					const gross = round1(item.purchasingMass);
					extraHtml = ` <span class="gross-mass" data-tooltip="${escapeHtml(t.renderer.purchasingWeight)}">${gross}g ${escapeHtml(t.renderer.gross)}</span>`;
				}
				html += `    <li>${formatElement(item, "html", { ...context, formatMode: "shopping-list" })}${extraHtml}</li>\n`;
			}
		});
		html += `  </ul>\n`;
		html += `</details>\n\n`;
		return html;
	},

	renderCookware(data, context, options) {
		if (!data.cookware || data.cookware.length === 0) return "";
		const t = getDictionary(options.lang);

		let html = "";
		const cookwareListClass = options.classes?.cookwareList || "cookware";
		html += `<details class="${cookwareListClass}">\n`;
		html += `  <summary><h2>${t.renderer.cookware}</h2></summary>\n`;
		html += `  <ul>\n`;
		data.cookware.forEach((cw: any) => {
			// formatElement dispatches on cw.type, so a plain cookware item and
			// an alternative group both go through the same call. The context
			// here never sets formatMode (leaf cookware has always rendered its
			// quantity as a tooltip, not a visible span — unchanged on purpose),
			// but strategies.alternative's default "inline" mode only shows the
			// first option with an "(alt)" badge — force non-inline just for a
			// group so every option joins on one line ("pan or skillet") instead.
			const cwContext = isAlternativeGroup(cw)
				? { ...context, formatMode: "shopping-list" as const }
				: context;
			html += `    <li>${formatElement(cw, "html", cwContext)}</li>\n`;
		});
		html += `  </ul>\n`;
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
						'<i class="ph ph-clock-counter-clockwise"></i>';
					titleHtml += ` <small class="section-meta-badge section-meta-retroplanning">${rIcon} ${escapeHtml(sec.retro_planning.raw)}</small>`;
				}

				// Section Mass
				if (sec.metrics && sec.metrics.totalMass > 0) {
					const mass = Math.round(sec.metrics.totalMass);
					let msg = `${mass}g`;
					let title = t.renderer.sectionStandardizedMass;
					if (sec.metrics.massStatus === "estimated") {
						msg = `~${mass}g`;
						title += t.renderer.estimatedSuffix;
					} else if (sec.metrics.massStatus === "incomplete") {
						msg = `>${mass}g`;
						const missingStr =
							sec.metrics.missingMassIngredients?.join(", ") ||
							t.renderer.someIngredients;
						title += `${t.renderer.missingMass}${missingStr})`;
					}
					const sIcon = options.icons?.scales ?? '<i class="ph ph-scales"></i>';
					titleHtml += ` <small class="section-meta-badge section-meta-mass" data-tooltip="${escapeHtml(title)}">${sIcon} ${msg}</small>`;
				}

				if (sec.intermediate_preparation) {
					const arrowIcon =
						options.icons?.arrowRight ?? '<i class="ph ph-arrow-right"></i>';
					titleHtml += ` <span class="section-declaration-badge" data-tooltip="${escapeHtml(t.renderer.intermediateResult)}">${arrowIcon} ${escapeHtml(sec.intermediate_preparation)}</span>`;
				}

				if (sec.module) {
					const packageIcon =
						options.icons?.package ?? '<i class="ph ph-package"></i>';
					titleHtml += ` <small class="section-meta-badge section-meta-module" data-tooltip="${escapeHtml(t.renderer.moduleFrom)}">${packageIcon} ${escapeHtml(moduleLabel(sec.module))}</small>`;
				}

				const sHeaderClass = options.classes?.sectionHeader
					? ` ${options.classes.sectionHeader}`
					: "";
				html += `    <h3 class="section-header${sHeaderClass}">${titleHtml}</h3>\n`;
			}

			// Section Ingredients — aggregated to remove duplicates and apply addition/segregation rules
			const sectionItems = aggregateSectionIngredients(
				sec.ingredients ?? [],
			).map(aggToRendererItem);
			if (sectionItems.length > 0) {
				const sIngredientsClass =
					options.classes?.sectionIngredients || "section-ingredients";
				html += `    <div class="${sIngredientsClass}">\n`;
				html += `      <ul>\n`;
				sectionItems.forEach((item: any) => {
					html += `        <li>${formatElement(item, "html", { ...context, formatMode: "mise-en-place" })}</li>\n`;
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
					const icon = options.icons?.info ?? '<i class="ph ph-info"></i>';
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
				html += `      <li value="${stepCounter}"${stepItemClass}>\n`;
				if (step.action) {
					const stepActionClass = options.classes?.stepAction
						? ` class="${options.classes.stepAction}"`
						: ' class="action"';
					html += `        <span${stepActionClass}>${escapeHtml(step.action)}</span> `;
				}

				// Declarations always render after every inline token, regardless of
				// their original position in the step (html.ts-specific choice — the
				// other formatters render declarations inline, in source order).
				const inlineItems = step.content.filter(
					(c: any) => c.type !== "declaration",
				);
				const declItems = step.content.filter(
					(c: any) => c.type === "declaration",
				);
				const renderGroup = (arr: any[]) =>
					joinStepTokens(
						arr,
						(c) => formatElement(c, "html", stepContext),
						(c) =>
							typeof c !== "string" &&
							c.type !== "comment" &&
							c.type !== "declaration",
					);

				const stepContent = renderGroup(inlineItems) + renderGroup(declItems);
				html += `        ${stepContent}\n`;
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
		html += `  <h3>Notes</h3>\n`;
		html += `  <ol>\n`;
		context._inlineComments.forEach((note, idx) => {
			const index = idx + 1;
			html += `    <li id="${renderId}-${index}">\n`;
			html += `      ${escapeHtml(note)}\n`;
			html += `      <a href="#ref-${renderId}-${index}" class="note-return" title="${escapeHtml(t.renderer.returnToStep)}">↩</a>\n`;
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

		// Interactive output emits every basis the recipe has and lets the reader
		// switch; static output renders the one `nutritionBasis` selects. The
		// switch is radio inputs plus sibling selectors — no JavaScript, which
		// matters because this HTML is also written to a standalone file by
		// `gram export` where no script would ever run.
		const bases =
			options.interactiveNutrition && !options.nutritionBasis
				? availableBases(nut, options.lang)
				: [resolveNutritionBasis(nut, options.nutritionBasis, options.lang)];

		const group = `nut-basis-${options.renderId ?? "recipe"}`;
		// The pre-selected basis is the one a static render would have shown, so
		// the panel opens on the same figures whether or not the toggle is there.
		const defaultKey = resolveNutritionBasis(nut, "auto", options.lang).key;

		let html = "";
		html += `<div class="nutrition-panel">\n`;
		html += `  <div class="nut-header">${escapeHtml(t.renderer.nutrition)} <span class="est-badge" data-tooltip="${escapeHtml(t.renderer.coverageTooltip)}: ${Math.round(nut.coverage * 100)}%">${escapeHtml(t.renderer.estimateTooltip)}</span></div>\n`;

		// The radios must precede every grid they control: the CSS matches them
		// as earlier siblings (`:checked ~ .nut-grid[data-basis=…]`).
		if (bases.length > 1) {
			bases.forEach((basis) => {
				const id = `${group}-${basis.key}`;
				const checked = basis.key === defaultKey ? " checked" : "";
				html += `  <input type="radio" class="nut-basis-radio" name="${escapeHtml(group)}" id="${escapeHtml(id)}" data-basis="${basis.key}"${checked} />\n`;
			});
			html += `  <div class="nut-basis-switch">\n`;
			bases.forEach((basis) => {
				const id = `${group}-${basis.key}`;
				html += `    <label for="${escapeHtml(id)}">${escapeHtml(basis.label)}</label>\n`;
			});
			html += `  </div>\n`;
		} else if (bases[0]) {
			html += `  <div class="nut-basis-single">${escapeHtml(bases[0].label)}</div>\n`;
		}

		for (const basis of bases) {
			// `data-default` marks the grid to fall back to when no radio in this
			// panel is checked — which happens when two panels share a page and
			// therefore a radio group. Without it the panel would render empty.
			const isDefault =
				bases.length > 1 && basis.key === defaultKey ? " data-default" : "";
			html += `  <div class="nut-grid" data-basis="${basis.key}"${isDefault}>\n`;
			// Sub-macros live inside their parent's card: "of which saturates" in
			// a cell of its own, the same size as Protein, reads as a nutrient in
			// its own right rather than a part of the fat next to it.
			for (const group of nutritionGroups(basis.values, options.lang)) {
				html += `    <div class="nut-item"><span class="label">${escapeHtml(group.label)}</span> <strong>${group.value} ${group.unit}</strong>`;
				if (group.children.length > 0) {
					html += `\n      <ul class="nut-item-children">\n`;
					for (const child of group.children) {
						html += `        <li><span class="label">${escapeHtml(child.label)}</span> <span class="value">${child.value} ${child.unit}</span></li>\n`;
					}
					html += `      </ul>\n    `;
				}
				html += `</div>\n`;
			}
			if (basis.note) {
				html += `    <p class="nut-basis-note">${escapeHtml(basis.note)}</p>\n`;
			}
			html += `  </div>\n`;
		}

		html += `</div>\n`;
		return html;
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

export function toHTML(
	data: RenderableCompilationResult,
	options: RendererOptions = {},
): string {
	return renderRecipe(data, options, htmlBackend);
}

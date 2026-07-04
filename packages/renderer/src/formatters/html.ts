import { RendererOptions, RenderContext } from '../types';
import { formatDuration as defaultFormatDuration, escapeHtml, aggToRendererItem, resolveBakersMath } from '../utils';
import { formatElement } from './element';
import { aggregateSectionIngredients } from '@gram/kitchen';

export function toHTML(data: any, options: RendererOptions = {}): string {
    const registry = data.registry || { ingredients: {}, cookware: {} };
    const formatDuration = options.formatDuration || defaultFormatDuration;
    const bakersMeta = resolveBakersMath(data, options);

    const context: RenderContext = {
        registry,
        icons: options.icons,
        classes: options.classes,
        formatDuration,
        formatFraction: options.formatFraction,
        bakersMathOnly: options.bakersMathOnly
    };

    let html = '';

    // Title
    if (data.title) {
        const titleClass = options.classes?.recipeTitle ? ` class="${options.classes.recipeTitle}"` : '';
        html += `<h1${titleClass}>${escapeHtml(data.title)}</h1>\n\n`;
    }

    // Display Metadata
    const recipeMetaClass = options.classes?.recipeMeta || 'recipe-meta';
    const metaItemClass = options.classes?.metaItem || 'meta-item';
    const metaIconClass = options.classes?.metaIcon || 'meta-icon';
    const metaContentClass = options.classes?.metaContent || 'meta-content';
    const metaLabelClass = options.classes?.metaLabel || 'meta-label';
    const metaValueClass = options.classes?.metaValue || 'meta-value';
    const metaEstClass = options.classes?.metaEst || 'est';

    const timingsGridClass = options.classes?.recipeTimingsGrid || 'recipe-timings-grid';
    const timingCardClass = options.classes?.timingCard || 'timing-card';

    html += `<div class="${timingsGridClass}">\n`;
    if (data.metrics) {
        // Total Time
        const clockIcon = options.icons?.clock ?? '<i class="ph ph-clock"></i>';
        html += ` <div class="${timingCardClass}">\n`;
        html += `   <div class="${metaLabelClass}">${clockIcon} Total Time</div>\n`;
        html += `   <div class="${metaValueClass}">${formatDuration(data.metrics.totalTime)}</div>\n`;
        html += ` </div>\n`;

        // Cook Time
        if (data.metrics.cookTime) {
            html += ` <div class="${timingCardClass}">\n`;
            html += `   <div class="${metaLabelClass}">${options.icons?.clock ?? '<i class="ph ph-clock"></i>'} Cook Time</div>\n`;
            html += `   <div class="${metaValueClass}">${formatDuration(data.metrics.cookTime)}</div>\n`;
            html += ` </div>\n`;
        }

        // Active Time
        const fireIcon = options.icons?.fire ?? '<i class="ph ph-fire"></i>';
        html += ` <div class="${timingCardClass}">\n`;
        html += `   <div class="${metaLabelClass}">${fireIcon} Active Time</div>\n`;
        html += `   <div class="${metaValueClass}">${formatDuration(data.metrics.activeTime)}</div>\n`;
        html += ` </div>\n`;

        // Prep Time
        const knifeIcon = options.icons?.knife ?? '<i class="ph ph-knife"></i>';
        html += ` <div class="${timingCardClass}">\n`;
        html += `   <div class="${metaLabelClass}">${knifeIcon} Prep Time</div>\n`;
        html += `   <div class="${metaValueClass}">${formatDuration(data.metrics.preparationTime)} <span class="${metaEstClass}">(est.)</span></div>\n`;
        html += ` </div>\n`;
    }
    html += `</div>\n`;

    // Secondary Metrics (Mass, etc) & Metadata combined
    const recipeMetaSecondaryClass = options.classes?.recipeMetaSecondary || 'recipe-meta-secondary';
    const metadataGridClass = options.classes?.metadataGrid || 'metadata-grid';
    const metaSecondaryItemClass = options.classes?.metaSecondaryItem || 'meta-secondary-item';

    html += `<div class="${recipeMetaSecondaryClass}">\n`;
    html += `<div class="${metadataGridClass}">\n`;

    if (data.metrics && data.metrics.totalMass) {
        const mass = Math.round(data.metrics.totalMass);
        let msg = `${mass}g`;
        if (data.metrics.massStatus === 'estimated') {
            msg = `~${mass}g (Estimated)`;
        }
        if (data.metrics.massStatus === 'incomplete') {
            msg = `${mass}g (Incomplete)`;
        }
        html += `  <div class="${metaSecondaryItemClass}">\n`;
        html += `    <span class="label">Total Mass</span>\n`;
        html += `    <span class="value">${msg}</span>\n`;
        html += `  </div>\n`;
    }

    if (data.meta) {
        for (const [k, v] of Object.entries(data.meta)) {
            if (k !== 'title') {
                html += `  <div class="${metaSecondaryItemClass}">\n`;
                html += `    <span class="label">${escapeHtml(k)}</span>\n`;
                html += `    <span class="value">${escapeHtml(String(v))}</span>\n`;
                html += `  </div>\n`;
            }
        }
    }

    html += `</div>\n`;
    html += `</div>\n\n`;

    // Shopping List
    if (data.shopping_list && data.shopping_list.length > 0) {
        const shoppingListClass = options.classes?.shoppingList || 'shopping-list';
        html += `<details class="${shoppingListClass}">\n`;
        html += `  <summary><h2>Shopping List</h2></summary>\n`;
        html += `  <ul>\n`;
        data.shopping_list.forEach((item: any) => {
            if (item.type === 'alternative' || item.type === 'group') {
                html += `    <li>\n`;
                html += `      <strong>Alternative Group</strong>:\n`;
                html += `      <ul>\n`;
                item.options.forEach((opt: any) => {
                    html += `        <li>${formatElement(opt, 'html', { ...context, formatMode: 'shopping-list' })}</li>\n`;
                });
                html += `      </ul>\n`;
                html += `    </li>\n`;
            } else if (item.type === 'composite') {
                html += `    <li>\n`;
                html += `      ${formatElement(item, 'html', { ...context, formatMode: 'shopping-list' })} <strong>(Composite)</strong>:\n`;
                html += `      <ul>\n`;
                item.usage.forEach((child: any) => {
                    html += `        <li>${formatElement(child, 'html', { ...context, formatMode: 'shopping-list' })}</li>\n`;
                });
                html += `      </ul>\n`;
                html += `    </li>\n`;
            } else if (item.display) {
                html += `    <li>${escapeHtml(item.display)}</li>\n`;
            } else {
                let extraHtml = '';
                if (item.purchasingMass && item.purchasingMass !== item.normalizedMass) {
                    // Show Gross Mass if different from Net
                    const gross = Math.round(item.purchasingMass * 10) / 10;
                    extraHtml = ` <span class="gross-mass" data-tooltip="Purchasing Weight (including waste/peel)">${gross}g gross</span>`;
                }
                html += `    <li>${formatElement(item, 'html', { ...context, formatMode: 'shopping-list' })}${extraHtml}</li>\n`;
            }
        });
        html += `  </ul>\n`;
        html += `</details>\n\n`;
    }

    // Cookware
    if (data.cookware && data.cookware.length > 0) {
        const cookwareListClass = options.classes?.cookwareList || 'cookware';
        html += `<details class="${cookwareListClass}">\n`;
        html += `  <summary><h2>Cookware</h2></summary>\n`;
        html += `  <ul>\n`;
        data.cookware.forEach((cw: any) => {
            if (cw.type === 'alternative' || cw.type === 'group') {
                html += `    <li>\n`;
                html += `      <strong>Alternative Group</strong>:\n`;
                html += `      <ul>\n`;
                cw.options.forEach((opt: any) => {
                    html += `        <li>${formatElement(opt, 'html', context)}</li>\n`;
                });
                html += `      </ul>\n`;
                html += `    </li>\n`;
            } else {
                html += `    <li>${formatElement(cw, 'html', context)}</li>\n`;
            }
        });
        html += `  </ul>\n`;
        html += `</details>\n\n`;
    }

    // Instructions
    if (data.sections && data.sections.length > 0) {
        const instructionsClass = options.classes?.instructions || 'instructions';
        html += `<div class="${instructionsClass}">\n`;
        data.sections.forEach((sec: any) => {
            html += `  <section>\n`;
            if (sec.title) {
                let titleHtml = escapeHtml(sec.title);
                if (sec.retro_planning) {
                    const rIcon = options.icons?.clockCounterClockwise ?? '<i class="ph ph-clock-counter-clockwise"></i>';
                    titleHtml += ` <small class="section-meta-badge section-meta-retroplanning">${rIcon} ${escapeHtml(sec.retro_planning)}</small>`;
                }

                // Section Mass
                if (sec.metrics && sec.metrics.totalMass > 0) {
                    const mass = Math.round(sec.metrics.totalMass);
                    let msg = `${mass}g`;
                    let title = "Section standardized mass";
                    if (sec.metrics.massStatus === 'estimated') {
                        msg = `~${mass}g`;
                        title += " (Estimated)";
                    }
                    const sIcon = options.icons?.scales ?? '<i class="ph ph-scales"></i>';
                    titleHtml += ` <small class="section-meta-badge section-meta-mass" data-tooltip="${title}">${msg}</small>`;
                }

                if (sec.intermediate_preparation) {
                    const arrowIcon = options.icons?.arrowRight ?? '<i class="ph ph-arrow-right"></i>';
                    titleHtml += ` <span class="section-declaration-badge" data-tooltip="Intermediate result for this section">${arrowIcon} ${escapeHtml(sec.intermediate_preparation)}</span>`;
                }

                const sHeaderClass = options.classes?.sectionHeader ? ` ${options.classes.sectionHeader}` : '';
                html += `    <h3 class="section-header${sHeaderClass}">${titleHtml}</h3>\n`;
            }

            // Section Ingredients — aggregated to remove duplicates and apply addition/segregation rules
            const sectionItems = aggregateSectionIngredients(sec.ingredients ?? []).map(aggToRendererItem);
            if (sectionItems.length > 0) {
                const sIngredientsClass = options.classes?.sectionIngredients || 'section-ingredients';
                html += `    <div class="${sIngredientsClass}">\n`;
                html += `      <ul>\n`;
                sectionItems.forEach((item: any) => {
                    html += `        <li>${formatElement(item, 'html', { ...context, formatMode: 'mise-en-place' })}</li>\n`;
                });
                html += `      </ul>\n`;
                html += `    </div>\n`;
            }

            const stepsListClass = options.classes?.stepsList || 'steps';
            html += `    <ol class="${stepsListClass}">\n`;
            let stepCounter = 0;
            sec.steps.forEach((step: any) => {
                if (step.type === 'comment') {
                    const stepCommentClass = options.classes?.stepComment ? ` class="${options.classes.stepComment}"` : ' class="step-comment"';
                    html += `      <li${stepCommentClass}>\n`;
                    html += `        ${escapeHtml(step.value)}\n`;
                    html += `      </li>\n`;
                    return;
                }

                stepCounter++;
                const stepItemClass = options.classes?.stepItem ? ` class="${options.classes.stepItem}"` : '';
                html += `      <li value="${stepCounter}"${stepItemClass}>\n`;
                if (step.action) {
                    const stepActionClass = options.classes?.stepAction ? ` class="${options.classes.stepAction}"` : ' class="action"';
                    html += `        <span${stepActionClass}>${escapeHtml(step.action)}</span> `;
                }

                let stepContent = '';
                if (step.type === 'text') {
                    stepContent = escapeHtml(step.value);
                } else if (step.type === 'step') {
                    stepContent = step.content.map((c: any, i: number, arr: any[]) => {
                        let str = formatElement(c, 'html', context);

                        // Spacing Logic
                        const isObject = (typeof c !== 'string' && c.type !== 'text' && c.type !== 'comment');
                        if (isObject) {
                            const next = arr[i + 1];
                            if (next) {
                                let nextChar = '';
                                if (typeof next === 'string') nextChar = next.charAt(0);
                                else if (next.type === 'text') nextChar = next.value ? next.value.charAt(0) : '';

                                // Don't add space if next is glue (punctuation or space)
                                const isGlue = nextChar && /^[.,!?:;)]/.test(nextChar) || (nextChar && /^\s/.test(nextChar));
                                if (!isGlue) {
                                    str += ' ';
                                }
                            }
                        }
                        return str;
                    }).join('');
                }
                html += `        ${stepContent}\n`;
                html += `      </li>\n`;
            });
            html += `    </ol>\n`;
            html += `  </section>\n`;
        });
        html += `</div>\n`;
    }

    // Nutrition Panel (Moved to bottom)
    if (data.metrics && data.metrics.nutrition) {
        const nut = data.metrics.nutrition;

        // Show if we have calories OR if we have warnings (meaning ingredients exist but lack data)
        if ((nut.total && nut.total.calories > 0) || (nut.warnings && nut.warnings.length > 0)) {
            const total = nut.total || { calories: 0, protein: 0, carbs: 0, fat: 0 };

            let portionText = '';
            let portionVals = null;
            if (nut.perPortion) {
                portionText = ` (Per Portion)`;
                portionVals = nut.perPortion;
            }

            const displayVals = portionVals || total;

            const cal = Math.round(displayVals.calories);
            const p = displayVals.protein;
            const c = displayVals.carbs;
            const f = displayVals.fat;

            // Granular
            const sugar = displayVals.sugar !== undefined ? displayVals.sugar : '-';
            const fiber = displayVals.fiber !== undefined ? displayVals.fiber : '-';
            // sodium is stored/calculated in mg — round to nearest integer for display
            const sodium = displayVals.sodium !== undefined ? Math.round(displayVals.sodium) : '-';

            let warningsHtml = '';
            if (data.nutrition && data.nutrition.warnings && data.nutrition.warnings.length > 0) {
                warningsHtml = `  <div class="nut-warnings">\n`;
                data.nutrition.warnings.forEach((w: string) => {
                    warningsHtml += `    <p><strong>Incomplete data:</strong> ${escapeHtml(w)}</p>\n`;
                });
                warningsHtml += `  </div>\n`;
            }

            html += `<div class="nutrition-panel">\n`;
            html += warningsHtml;
            html += `  <div class="nut-header">Nutrition <span class="est-badge" data-tooltip="Coverage: ${Math.round(nut.coverage * 100)}%">Estimate</span>${portionText}</div>\n`;
            html += `  <div class="nut-grid">\n`;
            html += `    <div class="nut-item"><span class="label">Calories</span> <strong>${cal} kcal</strong></div>\n`;
            html += `    <div class="nut-item"><span class="label">Carbs</span> <strong>${c}g</strong><small class="nut-item-sugar">(sugar: ${sugar}g)</small></div>\n`;
            html += `    <div class="nut-item"><span class="label">Protein</span> <strong>${p}g</strong></div>\n`;
            html += `    <div class="nut-item"><span class="label">Fat</span> <strong>${f}g</strong></div>\n`;
            html += `    <div class="nut-item"><span class="label">Fiber</span> <strong>${fiber}g</strong></div>\n`;
            html += `    <div class="nut-item"><span class="label">Sodium</span> <strong>${sodium}mg</strong></div>\n`;
            html += `  </div>\n`;
            html += `</div>\n`;
        }
    }

    return html;
}

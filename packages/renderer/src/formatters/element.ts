import { RenderContext } from '../types';
import { escapeHtml, getQty, formatQuantityValue } from '../utils';

// Default icons mapping
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
        plus: '<i class="ph ph-plus"></i>'
    },
    md: {
        hourglass: '⏳ ',
        timer: '⏲️ ',
        thermometer: '🔥',
        caretRight: '👉',
        arrowRight: '->&',
        arrowUDownLeft: '',
        warning: ' ⚠️',
        pencilSimple: '',
        minus: '-',
        plus: '+'
    }
};

const strategies: Record<string, (item: any, format: 'html' | 'md', context: RenderContext) => string> = {
    ingredient: (item, format, context) => {
        const registry = context.registry || {};
        const ingredients = registry.ingredients || {};
        const def = ingredients[item.id];

        const baseName = def ? def.name : (item.id || '[Unknown Ingredient]');
        const name = item.alias || baseName;

        const qty = getQty(item);
        const formulaStr = item.formula ? `${item.formula.percent}% of ${item.formula.target}` : null;
        const isPartial = item.formula && item.formula.is_partial;

        const prep = item.preparation || '';
        const isOptional = item.modifiers && item.modifiers.includes('optional');
        const isReference = item.modifiers && item.modifiers.includes('reference');

        let normalizedMass = null;
        let isEstimate = false;
        let conversionMethod = '';
        if (item.normalizedMass) {
            normalizedMass = Math.round(item.normalizedMass * 10) / 10;
            isEstimate = !!item.isEstimate;
            conversionMethod = item.conversionMethod || '';
        }

        let plainQty = '';
        if (item.bakersPercentage !== undefined) {
            const perc = `${item.bakersPercentage}%`;
            let absMass = '';
            if (normalizedMass !== null) absMass = `${normalizedMass}g`;
            else if (qty) absMass = (qty.text || String(qty.value)) + (item.unit ? ` ${item.unit}` : '');
            plainQty = context.bakersMathOnly ? perc : `${perc} (${absMass})`;
        } else if (qty) {
            plainQty = (qty.text || String(qty.value)) + (item.unit ? ` ${item.unit}` : '');
        }
        if (item.variable_entries && item.variable_entries.length > 0 && item.bakersPercentage === undefined) {
            plainQty = plainQty ? `${plainQty} + ${item.variable_entries.join(' + ')}` : item.variable_entries.join(' + ');
        }

        let htmlQty = plainQty;
        if (format === 'html' && item.bakersPercentage !== undefined && !context.bakersMathOnly) {
            const perc = `${item.bakersPercentage}%`;
            let absMass = '';
            if (normalizedMass !== null) absMass = `${normalizedMass}g`;
            else if (qty) absMass = (qty.text || String(qty.value)) + (item.unit ? ` ${item.unit}` : '');
            htmlQty = `${perc} <span class="abs-qty">${escapeHtml(absMass)}</span>`;
        }

        if (format === 'html') {
            const baseClass = (item.type === 'reference') ? 'reference' : 'ingredient';
            const className = (item.type === 'reference')
                ? (context.classes?.reference || baseClass)
                : (context.classes?.ingredient || baseClass);

            const mode = context.formatMode || 'inline';

            if (mode === 'inline') {
                let tooltipLines = [];
                if (plainQty) tooltipLines.push(`${plainQty}`);

                if (item.bakersPercentage === undefined && normalizedMass !== null && conversionMethod !== 'relative') {
                    let massDisplay = `${normalizedMass}g`;
                    if (isEstimate) massDisplay = `~${massDisplay}`;
                    tooltipLines.push(`(Standardized: ${massDisplay})`);
                }

                if (prep) tooltipLines.push(`— ${prep}`);
                if (isOptional) tooltipLines.push(`(Optional)`);

                let html = `<span class="${className}" data-name="${escapeHtml(baseName)}"`;
                if (tooltipLines.length > 0) {
                    html += ` data-tooltip="${escapeHtml(tooltipLines.join('\n'))}"`;
                }
                html += `>${escapeHtml(name)}`;

                if (isPartial && !context.hideIngredientQty) {
                    const warningIcon = context.icons?.warning ?? DEFAULT_ICONS.html.warning;
                    html += ` <span class="quantity formula-qty" data-tooltip="Calculation partial or failed">${escapeHtml(formulaStr || '')} ${warningIcon}</span>`;
                }
                html += `</span>`;
                return html;
            } else {
                let html = `<span class="${className}" data-name="${escapeHtml(baseName)}">${escapeHtml(name)}`;

                if (!context.hideIngredientQty) {
                    if (isPartial) {
                        const warningIcon = context.icons?.warning ?? DEFAULT_ICONS.html.warning;
                        const formulaClass = context.classes?.formulaText ? ` ${context.classes.formulaText}` : '';
                        html += ` <span class="quantity formula-qty${formulaClass}" data-tooltip="Calculation partial or failed">${escapeHtml(formulaStr || '')} ${warningIcon}</span>`;
                    } else {
                        if (htmlQty) {
                            html += ` <span class="quantity">${htmlQty}</span>`;
                        }
                    }
                }

                if (normalizedMass !== null && conversionMethod !== 'relative') {
                    let display = `${normalizedMass}g`;
                    if (isEstimate) display = `~${display}`;
                    const badgeClass = context.classes?.massBadge || 'mass-badge';
                    html += ` <span class="${badgeClass}" data-tooltip="Standardized mass: ${normalizedMass}g">${display}</span>`;
                }

                if (prep && mode !== 'shopping-list') {
                    const prepClass = context.classes?.prepText || 'prep';
                    if (mode === 'mise-en-place') {
                        html += ` <span class="${prepClass}">&mdash; ${escapeHtml(prep)}</span>`;
                    } else {
                        html += ` <span class="${prepClass}">(${escapeHtml(prep)})</span>`;
                    }
                }
                if (isOptional) {
                    const optClass = context.classes?.optionalText || 'opt';
                    html += ` <span class="${optClass}">(optional)</span>`;
                }
                html += `</span>`;
                return html;
            }
        } else {
            let md = (item.type === 'reference') ? `👉*${name}*` : `**${name}**`;
            if (!context.hideIngredientQty) {
                if (isPartial) {
                    const warningSymbol = context.icons?.warning ?? DEFAULT_ICONS.md.warning;
                    md = `${name} (${formulaStr}${warningSymbol})`;
                } else if (plainQty) {
                    // plainQty already accounts for bakersPercentage/bakersMathOnly
                    // and folds in variable_entries — same logic the HTML branch uses.
                    md += ` (${plainQty})`;
                }
            }
            const mode = context.formatMode || 'inline';
            if (prep && mode !== 'shopping-list') {
                if (mode === 'mise-en-place') md += ` — ${prep}`;
                else md += ` (${prep})`;
            }
            if (isOptional) md += ' (optional)';
            return md;
        }
    },

    cookware: (item, format, context) => {
        const registry = context.registry || {};
        const cookwareList = registry.cookware || {};
        const def = cookwareList[item.id];
        const baseName = def ? def.name : (item.id || '[Unknown Cookware]');
        const name = item.alias || baseName;
        const qty = getQty(item);
        const qtyVal = qty ? qty.value : null;

        if (format === 'html') {
            const className = context.classes?.cookware || 'cookware';
            const mode = context.formatMode || 'inline';

            if (mode === 'inline') {
                let html = `<span class="${className}" data-name="${escapeHtml(baseName)}"`;
                if (qtyVal !== null) html += ` data-tooltip="Quantity: ${escapeHtml(String(qtyVal))}"`;
                html += `>${escapeHtml(name)}</span>`;
                return html;
            } else {
                let html = `<span class="${className}" data-name="${escapeHtml(baseName)}">${escapeHtml(name)}`;
                if (qtyVal !== null) html += ` <span class="quantity">${escapeHtml(String(qtyVal))}</span>`;
                html += `</span>`;
                return html;
            }
        } else {
            let md = `*${name}*`;
            if (qtyVal !== null) md += ` (${qtyVal})`;
            return md;
        }
    },

    timer: (item, format, context) => {
        const q = item.quantity || { value: '' };
        const qVal = formatQuantityValue(q);
        const unitStr = item.unit ? ` ${item.unit}` : '';
        const isPassive = !!item.isPassive;

        if (format === 'html') {
            const passiveClassStr = isPassive ? ' passive' : '';
            const className = (context.classes?.timer || 'timer') + passiveClassStr;
            const iconKey = isPassive ? 'hourglass' : 'timer';
            const icon = context.icons?.[iconKey] ?? DEFAULT_ICONS.html[iconKey];
            const tooltipStr = isPassive ? 'Passive Time (Waiting, resting...)' : 'Active Time';
            return `<span class="${className}" data-tooltip="${tooltipStr}" data-value="${escapeHtml(q.value)}" data-unit="${escapeHtml(item.unit || '')}">${icon} <span class="timer-text">${escapeHtml(qVal)}${escapeHtml(unitStr)}</span></span>`;
        } else {
            const prefix = context.icons?.hourglass !== undefined
                ? (isPassive ? context.icons.hourglass : (context.icons.timer ?? ''))
                : (isPassive ? DEFAULT_ICONS.md.hourglass : DEFAULT_ICONS.md.timer);
            const suffix = isPassive ? ' (passive)' : '';
            return `${prefix}${qVal}${unitStr}${suffix}`;
        }
    },

    temperature: (item, format, context) => {
        const termIcon = context.icons?.thermometer ?? (format === 'html' ? DEFAULT_ICONS.html.thermometer : DEFAULT_ICONS.md.thermometer);
        const className = context.classes?.temperature || 'temp';
        if (item.text) {
            const textVal = item.text;
            if (format === 'html') {
                return `<span class="${className}" data-semantic="${escapeHtml(textVal)}">${termIcon} ${escapeHtml(textVal)}</span>`;
            } else {
                return `${termIcon}${textVal}`;
            }
        } else {
            const q = item.quantity || { value: '' };
            const qVal = formatQuantityValue(q);
            const unitStr = item.unit ? ` ${item.unit}` : '';
            if (format === 'html') {
                return `<span class="${className}" data-value="${escapeHtml(q.value)}" data-unit="${escapeHtml(item.unit || '')}">${termIcon} ${escapeHtml(qVal)}${escapeHtml(unitStr)}</span>`;
            } else {
                return `${termIcon}${qVal}${unitStr}`;
            }
        }
    },

    reference: (item, format, context) => {
        const registry = context.registry || {};
        const ingredients = registry.ingredients || {};
        const def = ingredients[item.id];
        const name = def ? def.name : (item.id || '[Unknown Reference]');
        const qty = getQty(item);

        if (format === 'html') {
            const caretIcon = context.icons?.caretRight ?? DEFAULT_ICONS.html.caretRight;
            const className = context.classes?.reference || 'reference';
            const mode = context.formatMode || 'inline';

            if (mode === 'inline') {
                let tooltipText = 'Intermediate Ingredient';
                if (qty) {
                    const parts = [];
                    const baseQty = qty.text || String(qty.value);
                    parts.push(baseQty + (item.unit ? ` ${item.unit}` : ''));
                    if (item.variable_entries && item.variable_entries.length > 0) {
                        parts.push(...item.variable_entries);
                    }
                    tooltipText += `\nQuantity: ${parts.join(' + ')}`;
                }
                return `<span class="${className}" data-tooltip="${escapeHtml(tooltipText)}">${caretIcon} ${escapeHtml(name)}</span>`;
            } else {
                let html = `<span class="${className}">${caretIcon} ${escapeHtml(name)}`;
                if (qty) {
                    const parts = [];
                    const baseQty = qty.text || String(qty.value);
                    let first = escapeHtml(baseQty);
                    if (item.unit) first += ` <span class="unit">${escapeHtml(item.unit)}</span>`;
                    parts.push(first);
                    if (item.variable_entries && item.variable_entries.length > 0) {
                        parts.push(...item.variable_entries.map(escapeHtml));
                    }
                    html += ` <span class="quantity">${parts.join(' + ')}</span>`;
                }
                html += `</span>`;
                return html;
            }
        } else {
            let md = `👉*${name}*`;
            if (qty) {
                const parts = [];
                const qtyVal = qty.text || qty.value;
                let first = String(qtyVal);
                if (item.unit) first += ` ${item.unit}`;
                parts.push(first);
                if (item.variable_entries && item.variable_entries.length > 0) {
                    parts.push(...item.variable_entries);
                }
                md += ` (${parts.join(' + ')})`;
            }
            return md;
        }
    },

    declaration: (item, format, context) => {
        const name = item.name || '';
        if (format === 'html') {
            const arrowIcon = context.icons?.arrowElbowDownRight ?? '<i class="ph ph-arrow-elbow-down-right"></i>';
            const className = (context.classes?.declaration || 'declaration') + ' declaration-block';
            return `<span class="${className}">${arrowIcon} ${escapeHtml(name)}</span>`;
        } else {
            const prefix = context.icons?.arrowRight ?? DEFAULT_ICONS.md.arrowRight;
            return `${prefix}${name}`;
        }
    },

    comment: (item, format, context) => {
        const text = (item.value || '').trim();
        if (format === 'html') {
            if (context._inlineComments) {
                context._inlineComments.push(text);
                const index = context._inlineComments.length;
                const renderId = context._renderId || 'note';
                return `<sup class="footnote-ref"><a href="#${renderId}-${index}" id="ref-${renderId}-${index}">[${index}]</a></sup>`;
            } else {
                // Fallback if state is missing
                return `<span class="inline-comment">${escapeHtml(text)}</span>`;
            }
        } else {
            return ` *${text}*`;
        }
    },

    alternative: (item, format, context) => {
        const registry = context.registry || {};
        const cookwareList = registry.cookware || {};

        if (format === 'html') {
            const mode = context.formatMode || 'inline';
            if (mode === 'inline') {
                const firstOpt = item.options[0];
                const isCookware = firstOpt.type === 'cookware' || !!cookwareList[firstOpt.id];
                const resolvedOpt = { ...firstOpt, type: firstOpt.type || (isCookware ? 'cookware' : 'ingredient') };

                const altNames = item.options.slice(1).map((opt: any) => opt.name || opt.display || opt.id);

                let html = formatElement(resolvedOpt, format, context);
                html += ` <span class="ingredient-alt-badge" data-tooltip="Alternatives:\n${escapeHtml(altNames.join('\n'))}">(alt)</span>`;
                return html;
            } else {
                const separator = ' <span class="keyword">or</span> ';
                return item.options.map((opt: any) => {
                    const isCookware = opt.type === 'cookware' || !!cookwareList[opt.id];
                    const resolvedOpt = { ...opt, type: opt.type || (isCookware ? 'cookware' : 'ingredient') };
                    return formatElement(resolvedOpt, format, context);
                }).join(separator);
            }
        } else {
            const separator = ' or ';
            return item.options.map((opt: any) => {
                const isCookware = opt.type === 'cookware' || !!cookwareList[opt.id];
                const resolvedOpt = { ...opt, type: opt.type || (isCookware ? 'cookware' : 'ingredient') };
                return formatElement(resolvedOpt, format, context);
            }).join(separator);
        }
    },

    group: (item, format, context) => {
        // Alias alternative strategy for group AST type
        return strategies.alternative!(item, format, context);
    },

    composite: (item, format, context) => {
        // A composite item in the shopping list is essentially a parent ingredient.
        // We reuse the ingredient formatter to display it identically.
        return strategies.ingredient!({ ...item, type: 'ingredient' }, format, context);
    },

    text: (item, format) => {
        const text = item.value || '';
        return format === 'html' ? escapeHtml(text) : text;
    }
};

/**
 * Unified entry point to format an AST element.
 */
export function formatElement(element: any, format: 'html' | 'md', context: RenderContext = {}): string {
    if (element === null || element === undefined) return '';
    if (typeof element === 'string') {
        return format === 'html' ? escapeHtml(element) : element;
    }

    // Resolve strategy
    const type = element.type || '';

    // Check if it looks like an implicit ingredient/cookware step element (no type, has id)
    if (!type && element.id) {
        const registry = context.registry || {};
        const isCookware = !!(registry.cookware && registry.cookware[element.id]);
        const inferredType = isCookware ? 'cookware' : 'ingredient';
        return strategies[inferredType]!({ ...element, type: inferredType }, format, context);
    }

    const strategy = strategies[type];
    if (strategy) {
        return strategy(element, format, context);
    }

    // Fallback for unknown elements
    return format === 'html' ? escapeHtml(String(element.value || '')) : String(element.value || '');
}

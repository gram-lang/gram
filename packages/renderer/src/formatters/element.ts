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
        pencilSimple: '<i class="ph ph-pencil-simple"></i>'
    },
    md: {
        hourglass: '⏳ ',
        timer: '⏲️ ',
        thermometer: '🔥',
        caretRight: '👉',
        arrowRight: '->&',
        arrowUDownLeft: '',
        warning: ' ⚠️',
        pencilSimple: ''
    }
};

const strategies: Record<string, (item: any, format: 'html' | 'md', context: RenderContext) => string> = {
    ingredient: (item, format, context) => {
        const registry = context.registry || {};
        const ingredients = registry.ingredients || {};
        const def = ingredients[item.id];
        
        // Defensive Lookup Fallback
        const baseName = def ? def.name : (item.id || '[Unknown Ingredient]');
        const name = item.alias || baseName;
        
        const qty = getQty(item);
        const formulaStr = item.formula ? `${item.formula.percent}% of ${item.formula.target}` : null;
        const isPartial = item.formula && item.formula.is_partial;
        
        // Extract optional preparation and modifiers
        const prep = item.preparation || '';
        const isOptional = item.modifiers && item.modifiers.includes('optional');
        const isReference = item.modifiers && item.modifiers.includes('reference');
        
        // Prepare normalized mass
        let normalizedMass = null;
        let isEstimate = false;
        let conversionMethod = '';
        if (item.normalizedMass) {
            normalizedMass = Math.round(item.normalizedMass * 10) / 10;
            isEstimate = !!item.isEstimate;
            conversionMethod = item.conversionMethod || '';
        }
        
        // Setup quantity string parts
        let qtyContent = '';
        if (qty) {
            const baseQty = qty.text || String(qty.value);
            qtyContent += format === 'html' ? escapeHtml(baseQty) : baseQty;
            if (item.unit) {
                qtyContent += format === 'html' ? ` <span class="unit">${escapeHtml(item.unit)}</span>` : ` ${item.unit}`;
            }
        }
        
        if (item.variable_entries && item.variable_entries.length > 0) {
            const vars = format === 'html' 
                ? item.variable_entries.map((v: any) => escapeHtml(String(v))).join(' + ')
                : item.variable_entries.join(' + ');
            qtyContent = qtyContent ? `${qtyContent} + ${vars}` : vars;
        }
 
        if (format === 'html') {
            const baseClass = (item.type === 'reference') ? 'reference' : 'ingredient';
            const className = (item.type === 'reference')
                ? (context.classes?.reference || baseClass)
                : (context.classes?.ingredient || baseClass);

            let html = `<span class="${className}" data-name="${escapeHtml(baseName)}">${escapeHtml(name)}`;

            if (!context.hideIngredientQty) {
                if (isPartial) {
                    const warningIcon = context.icons?.warning ?? DEFAULT_ICONS.html.warning;
                    const formulaClass = context.classes?.formulaText ? ` ${context.classes.formulaText}` : '';
                    html += ` <span class="quantity formula-qty${formulaClass}" title="Calculation partial or failed">(${escapeHtml(formulaStr)} ${warningIcon})</span>`;
                } else {
                    if (qtyContent) {
                        html += ` <span class="quantity">(${qtyContent})</span>`;
                    }
                }
            }
            
            // Only show mass badge if the original quantity wasn't already in grams,
            // or if it wasn't a relative quantity resolved directly into grams
            if (normalizedMass !== null && conversionMethod !== 'relative') {
                let display = `${normalizedMass}g`;
                let title = `Calculated Mass: ${normalizedMass}g\nMethod: ${conversionMethod}`;
                if (isEstimate) {
                    display = `~${display}`;
                    title += ` (Estimated)`;
                }
                if (conversionMethod === 'explicit') {
                    const editIcon = context.icons?.pencilSimple ?? DEFAULT_ICONS.html.pencilSimple;
                    display = `${editIcon} ${display}`;
                    title += ` (User Override)`;
                } else if (conversionMethod === 'physical') {
                    title += ` (Exact)`;
                }
                const badgeClass = context.classes?.massBadge || 'mass-badge';
                html += ` <span class="${badgeClass}" title="${escapeHtml(title)}">${display}</span>`;
            }
            
            if (prep) {
                const prepClass = context.classes?.prepText || 'prep';
                html += ` <span class="${prepClass}">(${escapeHtml(prep)})</span>`;
            }
            if (isOptional) {
                const optClass = context.classes?.optionalText || 'opt';
                html += ` <span class="${optClass}">(optional)</span>`;
            }
            if (isReference) {
                const refIcon = context.icons?.arrowUDownLeft ?? DEFAULT_ICONS.html.arrowUDownLeft;
                html += ` <span class="ref" title="Reference to existing ingredient">${refIcon}</span>`;
            }
            
            html += `</span>`;
            return html;
        } else {
            // Markdown / Plain Text Format
            let md = (item.type === 'reference') ? `👉*${name}*` : `**${name}**`;

            if (!context.hideIngredientQty) {
                if (isPartial) {
                    const warningSymbol = context.icons?.warning ?? DEFAULT_ICONS.md.warning;
                    md = `${name} (${formulaStr}${warningSymbol})`;
                } else {
                    let qtyParts = [];
                    if (qty) {
                        let qStr = qty.text || qty.value;
                        if (item.unit) qStr += ` ${item.unit}`;
                        qtyParts.push(qStr);
                    }
                    if (item.variable_entries && item.variable_entries.length > 0) {
                        qtyParts.push(...item.variable_entries);
                    }
                    if (qtyParts.length > 0) {
                        md += ` (${qtyParts.join(' + ')})`;
                    }
                }
            }
            
            if (prep) {
                md += ` (${prep})`;
            }
            if (isOptional) {
                md += ' (optional)';
            }
            return md;
        }
    },
     
    cookware: (item, format, context) => {
        const registry = context.registry || {};
        const cookwareList = registry.cookware || {};
        const def = cookwareList[item.id];
        
        // Defensive Lookup Fallback
        const baseName = def ? def.name : (item.id || '[Unknown Cookware]');
        const name = item.alias || baseName;
        
        const qty = getQty(item);
        const qtyVal = qty ? qty.value : null;
        
        if (format === 'html') {
            const className = context.classes?.cookware || 'cookware';
            let html = `<span class="${className}" data-name="${escapeHtml(baseName)}">${escapeHtml(name)}`;
            if (qtyVal !== null) {
                html += ` <span class="quantity">(${escapeHtml(String(qtyVal))})</span>`;
            }
            html += `</span>`;
            return html;
        } else {
            let md = `*${name}*`;
            if (qtyVal !== null) {
                md += ` (${qtyVal})`;
            }
            return md;
        }
    },
     
    timer: (item, format, context) => {
        const q = item.quantity || { value: '' };
        const qVal = formatQuantityValue(q);
        const unitStr = item.unit ? ` ${item.unit}` : '';
        const isAsync = !!item.isAsync;
        
        if (format === 'html') {
            const asyncClassStr = isAsync ? ' async' : '';
            const className = (context.classes?.timer || 'timer') + asyncClassStr;
            const iconKey = isAsync ? 'hourglass' : 'timer';
            const icon = context.icons?.[iconKey] ?? DEFAULT_ICONS.html[iconKey as keyof typeof DEFAULT_ICONS.html];
            return `<span class="${className}" data-value="${escapeHtml(q.value)}" data-unit="${escapeHtml(item.unit || '')}">${icon} ${escapeHtml(qVal)}${escapeHtml(unitStr)}</span>`;
        } else {
            const prefix = context.icons?.hourglass !== undefined 
                ? (isAsync ? context.icons.hourglass : (context.icons.timer ?? '')) 
                : (isAsync ? DEFAULT_ICONS.md.hourglass : DEFAULT_ICONS.md.timer);
            const suffix = isAsync ? ' (async)' : '';
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
            let html = `<span class="${className}">${caretIcon} ${escapeHtml(name)}`;
            if (qty) {
                const parts: string[] = [];
                const baseQty = qty.text || String(qty.value);
                let first = escapeHtml(baseQty);
                if (item.unit) first += ` <span class="unit">${escapeHtml(item.unit)}</span>`;
                parts.push(first);
                if (item.variable_entries && item.variable_entries.length > 0) {
                    parts.push(...(item.variable_entries as string[]).map(escapeHtml));
                }
                html += ` <span class="quantity">${parts.join(' + ')}</span>`;
            }
            html += `</span>`;
            return html;
        } else {
            let md = `👉*${name}*`;
            if (qty) {
                const parts: string[] = [];
                const qtyVal = qty.text || qty.value;
                let first = String(qtyVal);
                if (item.unit) first += ` ${item.unit}`;
                parts.push(first);
                if (item.variable_entries && item.variable_entries.length > 0) {
                    parts.push(...(item.variable_entries as string[]));
                }
                md += ` (${parts.join(' + ')})`;
            }
            return md;
        }
    },
     
    declaration: (item, format, context) => {
        const name = item.name || '';
        if (format === 'html') {
            const arrowIcon = context.icons?.arrowRight ?? DEFAULT_ICONS.html.arrowRight;
            const className = context.classes?.declaration || 'declaration';
            return `<span class="${className}" title="Intermediate result declaring this step's output">${arrowIcon} ${escapeHtml(name)}</span>`;
        } else {
            const prefix = context.icons?.arrowRight ?? DEFAULT_ICONS.md.arrowRight;
            return `${prefix}${name}`;
        }
    },
     
    comment: (item, format, context) => {
        const text = (item.value || '').trim();
        if (format === 'html') {
            return `<!-- ${escapeHtml(text)} -->`;
        } else {
            return ` *${text}*`;
        }
    },
     
    alternative: (item, format, context) => {
        const registry = context.registry || {};
        const cookwareList = registry.cookware || {};
        const separator = format === 'html' ? ' <span class="keyword">or</span> ' : ' or ';
        return item.options.map((opt: any) => {
            // Check if cookware either by explicit opt.type or checking the registry cookware list
            const isCookware = opt.type === 'cookware' || !!cookwareList[opt.id];
            const resolvedOpt = { ...opt, type: opt.type || (isCookware ? 'cookware' : 'ingredient') };
            return formatElement(resolvedOpt, format, context);
        }).join(separator);
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

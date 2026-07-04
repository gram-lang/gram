import { ASTNodeType } from '@gram/parser';
import type { AggregatedIngredient } from '@gram/kitchen';

// Converts an AggregatedIngredient to a plain object that formatElement can render.
// The first quantity becomes qty/unit; additional ones become variable_entries strings.
export function aggToRendererItem(agg: AggregatedIngredient): Record<string, unknown> {
    const base: Record<string, unknown> = { id: agg.id, name: agg.name }
    if (agg.type) base.type = agg.type
    if (agg.preparation) base.preparation = agg.preparation
    if (agg.normalizedMass !== undefined) base.normalizedMass = agg.normalizedMass
    if (agg.conversionMethod !== undefined) base.conversionMethod = agg.conversionMethod
    if (agg.isEstimate !== undefined) base.isEstimate = agg.isEstimate

    if (!agg.quantities || agg.quantities.length === 0) {
        return base;
    }
    
    const [first, ...rest] = agg.quantities
    if (first) {
        base.qty = first.qty
        base.unit = first.unit ?? null
    }
    if (rest.length > 0) {
        base.variable_entries = rest.map(q => {
            const qty = q.qty as any
            const qStr = qty?.text ?? (typeof qty === 'number' ? String(qty) : String(qty?.value ?? qty))
            return q.unit ? `${qStr} ${q.unit}` : qStr
        })
    }
    return base
}

/**
 * Formats a decimal number to a fraction if possible (e.g. 0.5 -> 1/2).
 */
export function formatDecimalToFraction(value: unknown): string {
    if (typeof value !== 'number') return String(value);
    
    // Exact integers
    if (Math.abs(value - Math.round(value)) < 0.01) {
        return String(Math.round(value));
    }

    // Fractions only for values strictly below 1
    if (value < 1) {
        const commonFractions = [
            { val: 0.5, str: '1/2' },
            { val: 0.25, str: '1/4' },
            { val: 0.75, str: '3/4' },
            { val: 1/3, str: '1/3' },
            { val: 2/3, str: '2/3' },
            { val: 0.125, str: '1/8' },
            { val: 0.375, str: '3/8' },
            { val: 0.625, str: '5/8' },
            { val: 0.875, str: '7/8' }
        ];
        const match = commonFractions.find(f => Math.abs(value - f.val) < 0.01);
        if (match) return match.str;
    }

    return String(parseFloat(value.toFixed(2)));
}

export interface ExtractedQuantity {
    value: number | string | null;
    text?: string;
    isRelative?: boolean;
}

/**
 * Extracts and normalizes quantity information from an item.
 */
export function getQty(item: Record<string, unknown>): ExtractedQuantity | undefined {
    if (item.qty !== undefined) {
        if (typeof item.qty === 'number') {
            return { value: item.qty, text: formatDecimalToFraction(item.qty) };
        }
        if (typeof item.qty === 'object' && item.qty !== null && (item.qty as any).type === ASTNodeType.RelativeQuantity) {
            const rel = item.qty as any;
            return { 
                value: null, 
                text: `${rel.percent}% of ${rel.target}`,
                isRelative: true
            };
        }
        return item.qty as ExtractedQuantity;
    }
    if (item.quantity) return item.quantity as ExtractedQuantity;
    return undefined;
}

/**
 * Helper to display Timer/Temperature range or value.
 */
export function formatQuantityValue(q: any): string {
    if (!q) return '';
    if (q.type === 'range' && q.text) return q.text;
    if (q.text) return q.text;
    if (q.type === ASTNodeType.RelativeQuantity) {
        return `${q.percent}% of ${q.target}`;
    }
    if (q.value !== undefined) return String(q.value);
    return String(q);
}

/**
 * Formats duration values into human readable strings (e.g. 90 -> 1h 30m).
 */
export function formatDuration(minutes: number): string {
    if (!minutes) return '0m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}h ${m > 0 ? m + 'm' : ''}`;
    return `${m}m`;
}

/**
 * Safely escapes HTML special characters to prevent XSS.
 */
export function escapeHtml(unsafe: string | null | undefined): string {
    if (unsafe === undefined || unsafe === null) return '';
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

/**
 * Applies baker's math logic to format a quantity string.
 */
export function applyBakersMath(
    itemMass: number | null,
    fallbackQty: string,
    context: import('./types').RenderContext
): string {
    if (!context._bakersMathEnabled || !context._bakersMathReferenceMass || itemMass == null || context._bakersMathReferenceMass === 0) {
        return fallbackQty;
    }
    const percentage = Math.round((itemMass / context._bakersMathReferenceMass) * 100);
    if (context._bakersMathOnly) {
        return `${percentage}%`;
    }
    return `${percentage}% — ${fallbackQty}`;
}

/**
 * Resolves the baker's math context by finding the reference ingredient.
 */
export function resolveBakersMath(
    data: any,
    options: import('./types').RendererOptions
): { enabled: boolean; referenceMass: number | null; only: boolean } {
    const isEnabled = options.bakersReference !== undefined || options.bakersMathOnly;
    if (!isEnabled) {
        return { enabled: false, referenceMass: null, only: false };
    }

    let referenceId: string | null = null;
    if (typeof options.bakersReference === 'string' && options.bakersReference !== '') {
        referenceId = options.bakersReference;
    } else {
        const sections = data.sections || [];
        for (const sec of sections) {
            for (const ing of (sec.ingredients || [])) {
                if (ing.modifiers && ing.modifiers.includes('bakers_percentage')) {
                    referenceId = ing.id;
                    break;
                }
            }
            if (referenceId) break;
        }
    }

    if (!referenceId) {
        console.warn(`\n\x1b[33mWarning: No baker's percentage reference found in recipe. Use --bakers-math=<id> to specify one.\x1b[0m`);
        return { enabled: false, referenceMass: null, only: false };
    }

    let referenceMass: number | null = null;
    const shoppingList = data.shopping_list || [];
    const refItem = shoppingList.find((i: any) => i.id === referenceId);
    if (refItem) {
        // If rendered from an analyzed recipe, normalizedMass is used. Otherwise qty.
        referenceMass = refItem.normalizedMass !== undefined ? refItem.normalizedMass : (typeof refItem.qty === 'number' ? refItem.qty : null);
    }

    return {
        enabled: true,
        referenceMass,
        only: !!options.bakersMathOnly
    };
}

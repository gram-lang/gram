import { ASTNodeType } from '@gram/parser';
import type { AggregatedIngredient } from '@gram/kitchen';

// Converts an AggregatedIngredient to a plain object that formatElement can render.
// The first quantity becomes qty/unit; additional ones become variable_entries strings.
export function aggToRendererItem(agg: AggregatedIngredient): Record<string, unknown> {
    const base: Record<string, unknown> = { id: agg.id, name: agg.name }
    if (agg.type) base.type = agg.type
    if (agg.preparation) base.preparation = agg.preparation
    
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

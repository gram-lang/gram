import type { Usage } from './types'

export interface AggregatedIngredient {
    id: string
    name: string
    // null = unmeasured (Rule 2: dedup); array = measured occurrences in order (Rule 1: addition)
    // Rule 3 (segregation): a given id can have both an unmeasured entry AND a measured entry simultaneously
    quantities: Array<{ qty: NonNullable<Usage['qty']>; unit?: string | null }> | null
}

/**
 * Aggregates a flat list of section Usage items into display-ready entries:
 *
 *   Rule 1 — Addition:    measured + measured → one entry, quantities joined with '+'
 *   Rule 2 — Dedup:       unmeasured + unmeasured → one entry
 *   Rule 3 — Segregation: measured ≠ unmeasured → always two separate entries
 *
 * Insertion order from the source list is preserved.
 */
export function aggregateSectionIngredients(ingredients: Usage[]): AggregatedIngredient[] {
    const measuredByID = new Map<string, AggregatedIngredient>()
    const unmeasuredByID = new Map<string, AggregatedIngredient>()
    const order: AggregatedIngredient[] = []

    for (const ing of ingredients) {
        if (ing.type === 'composite' || ing.type === 'alternative') continue

        const name = ing.name ?? ing.id
        const hasMeasuredQty = ing.qty != null

        if (hasMeasuredQty) {
            const existing = measuredByID.get(ing.id)
            if (existing) {
                existing.quantities!.push({ qty: ing.qty!, unit: ing.unit ?? null })
            } else {
                const entry: AggregatedIngredient = {
                    id: ing.id,
                    name,
                    quantities: [{ qty: ing.qty!, unit: ing.unit ?? null }],
                }
                measuredByID.set(ing.id, entry)
                order.push(entry)
            }
        } else {
            if (!unmeasuredByID.has(ing.id)) {
                const entry: AggregatedIngredient = { id: ing.id, name, quantities: null }
                unmeasuredByID.set(ing.id, entry)
                order.push(entry)
            }
        }
    }

    return order
}

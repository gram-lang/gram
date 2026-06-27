import pLimit from 'p-limit'
import { basename } from 'node:path'
import { normalizeUnit } from '@gram/i18n'
import { runPipeline } from '../core/pipeline'
import { fmtNumber } from '../core/format'
import type { IngredientData } from '@gram/analyzer'
import type { ShopResult, ShoppingEntry } from '../types'

export interface ShopOptions {
  db?: Record<string, IngredientData> | null
  scaleFactor?: number
}

interface CollectedItem {
  id: string
  name: string
  qty: number
  unit?: string
  normalizedMass?: number
  isEstimate?: boolean
  recipe: string
}

function formatMass(grams: number): string {
  if (grams >= 1000) return `${fmtNumber(grams / 1000)} kg`
  return `${fmtNumber(Math.round(grams), 0)} g`
}

const CATEGORY_ORDER = ['Dairy', 'Meat', 'Fish', 'Produce', 'Grains', 'Fat', 'Spice', 'Other']


export async function buildShoppingList(
  files: string[],
  opts: ShopOptions = {},
): Promise<ShopResult> {
  const limit = pLimit(20)
  const allItems: CollectedItem[] = []
  const noQtyIds: string[] = []

  await Promise.all(
    files.map(file =>
      limit(async () => {
        const slug = basename(file, '.gram')
        const trackNoQty = (item: CollectedItem) => {
          if (!(item as any).type && !(item as any).variable_entries) {
            noQtyIds.push(item.name ?? item.id)
          }
        }

        if (opts.db) {
          const { analyzed } = await runPipeline(file, { db: opts.db, scaleFactor: opts.scaleFactor })
          if (analyzed) {
            for (const item of analyzed.result.shopping_list as CollectedItem[]) {
              if ((item as any).type === 'alternative' || (item as any).variable_entries) continue
              if (typeof item.qty !== 'number' || !isFinite(item.qty)) { trackNoQty(item); continue }
              allItems.push({ ...item, recipe: slug })
            }
          }
        } else {
          const { compiled } = await runPipeline(file, { skipAnalyzer: true, scaleFactor: opts.scaleFactor })
          for (const item of compiled.shopping_list as CollectedItem[]) {
            if ((item as any).type === 'alternative' || (item as any).variable_entries) continue
            if (typeof item.qty !== 'number' || !isFinite(item.qty)) { trackNoQty(item); continue }
            allItems.push({ ...item, recipe: slug })
          }
        }
      }),
    ),
  )

  // Group by ingredient id
  const grouped = new Map<string, CollectedItem[]>()
  for (const item of allItems) {
    const bucket = grouped.get(item.id) ?? []
    bucket.push(item)
    grouped.set(item.id, bucket)
  }

  const entries: ShoppingEntry[] = []
  const warnings: string[] = []

  for (const [id, items] of grouped) {
    const recipes = [...new Set(items.map(i => i.recipe))]
    const displayName = opts.db?.[id]?.name ?? items[0]?.name ?? id
    const category = opts.db?.[id]?.tags?.[0] ?? 'Other'
    let fullyAggregated = false;
    let finalEntry: Partial<ShoppingEntry> = {};

    if (opts.db) {
      const massItems = items.filter(i => i.normalizedMass != null)
      if (massItems.length === items.length) {
        const totalMass = massItems.reduce((sum, i) => sum + (i.normalizedMass ?? 0), 0)
        fullyAggregated = true;
        finalEntry = {
          displayQty: formatMass(totalMass),
          isEstimate: massItems.some(i => i.isEstimate)
        }
      }
    }

    if (!fullyAggregated) {
      const units = new Set(items.map(i => normalizeUnit(i.unit)))
      if (units.size === 1) {
        const total = items.reduce((sum, i) => sum + i.qty, 0)
        const unit = normalizeUnit(items[0]?.unit)
        fullyAggregated = true;
        finalEntry = {
          displayQty: unit ? `${fmtNumber(total)} ${unit}` : fmtNumber(total),
          isEstimate: false
        }
      }
    }

    if (fullyAggregated) {
      entries.push({
        id,
        name: displayName,
        displayQty: finalEntry.displayQty!,
        isEstimate: finalEntry.isEstimate!,
        recipes,
        category,
        cannotAggregate: false
      })
    } else {
      const unitList = [...new Set(items.map(u => u.unit || 'count'))].join(', ')
      const tip = opts.db ? 'add density to database to aggregate' : 'add to database to aggregate'
      warnings.push(`${id}: mixed units (${unitList}) — listed separately (${tip})`)
      entries.push({
        id,
        name: displayName,
        displayQty: items.map(i => `${i.qty}${i.unit ? ` ${i.unit}` : ''} (${i.recipe})`).join(' + '),
        isEstimate: false,
        recipes,
        category,
        cannotAggregate: true
      })
    }
  }

  entries.sort((a, b) => a.name.localeCompare(b.name))

  const byCategory = new Map<string, ShoppingEntry[]>()
  for (const entry of entries) {
    const bucket = byCategory.get(entry.category) ?? []
    bucket.push(entry)
    byCategory.set(entry.category, bucket)
  }

  const sortedByCategory = new Map(
    [...byCategory.entries()].sort(([a], [b]) => {
      const ai = CATEGORY_ORDER.indexOf(a)
      const bi = CATEGORY_ORDER.indexOf(b)
      if (ai !== -1 && bi !== -1) return ai - bi
      if (ai !== -1) return -1
      if (bi !== -1) return 1
      return a.localeCompare(b)
    }),
  )

  const uniqueRecipes = new Set(allItems.map(i => i.recipe))

  const noQtyWarnings = [...new Set(noQtyIds)].map(
    name => `${name}: no quantity specified — not included in list (add a quantity to your recipe)`,
  )

  return {
    items: entries,
    byCategory: sortedByCategory,
    warnings: [...warnings, ...noQtyWarnings],
    recipeCount: uniqueRecipes.size,
  }
}

import { runPipeline } from '../core/pipeline'
import type { IngredientData } from '@gram/analyzer'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ScaledItem {
  id: string
  name?: string
  unit?: string | null
  originalQty?: number
  scaledQty?: number
  nonScalable?: boolean
}

interface ParsedRef {
  id: string
  value: number
  unit: string | null
}

// ── Parsers ──────────────────────────────────────────────────────────────────

/** Parses a ref string like "farine=300g" into its components. */
export function parseRef(raw: string): ParsedRef {
  const eqIdx = raw.indexOf('=')
  if (eqIdx === -1) {
    throw new Error(`Invalid ref syntax: "${raw}". Expected id=value (e.g. farine=300g).`)
  }
  const id = raw.slice(0, eqIdx).trim()
  const valueStr = raw.slice(eqIdx + 1).trim()
  const match = valueStr.match(/^([\d.]+)\s*([a-zA-Z%°]*)$/)
  if (!match || !match[1]) {
    throw new Error(
      `Cannot parse quantity "${valueStr}". Expected a number with optional unit (e.g. 300g, 200ml, 3).`,
    )
  }
  const value = parseFloat(match[1])
  if (isNaN(value) || value <= 0) {
    throw new Error(`Invalid quantity "${valueStr}". Must be a positive number.`)
  }
  return { id, value, unit: match[2]?.trim() || null }
}

/**
 * Parses the unified --scale flag value.
 * "1.5"          → factor mode
 * "farine=300g"  → ref mode
 */
export function parseScaleArg(raw: string): { type: 'factor'; value: number } | { type: 'ref'; raw: string } {
  if (raw.includes('=')) return { type: 'ref', raw }
  const value = parseFloat(raw)
  if (isNaN(value) || value <= 0) {
    throw new Error(`Invalid --scale value "${raw}". Use a positive number (e.g. 1.5) or a reference (e.g. farine=300g).`)
  }
  return { type: 'factor', value }
}

// ── Factor resolution ─────────────────────────────────────────────────────────

/**
 * Resolves a --scale flag value to a numeric scale factor.
 * For ref mode, runs a single unscaled pipeline to read the reference ingredient's quantity.
 */
export async function resolveScaleFactor(
  filePath: string,
  scale: string,
  db: Record<string, IngredientData> | null | undefined,
): Promise<number> {
  const parsed = parseScaleArg(scale)

  if (parsed.type === 'factor') return parsed.value

  // Ref mode: need the original shopping list to compute the ratio
  const ref = parseRef(parsed.raw)
  const { compiled } = await runPipeline(filePath, { db, skipAnalyzer: !db })
  const shoppingList = compiled.shopping_list as any[]

  const item = shoppingList.find(
    (i: any) => i.type !== 'composite' && i.type !== 'alternative' && i.id === ref.id,
  )
  if (!item) {
    const available = shoppingList
      .filter((i: any) => i.type !== 'composite' && i.type !== 'alternative')
      .map((i: any) => i.id)
      .join(', ')
    throw new Error(
      `Ingredient "${ref.id}" not found in recipe shopping list.\nAvailable: ${available}`,
    )
  }
  if (typeof item.qty !== 'number') {
    throw new Error(
      `Cannot use "${ref.id}" as reference: its quantity ("${item.qty}") is not a simple number.`,
    )
  }

  const itemUnit = item.unit || null
  const refUnit = ref.unit
  if (refUnit && itemUnit && refUnit !== itemUnit) {
    throw new Error(
      `Unit mismatch: you specified "${refUnit}" but the recipe uses "${itemUnit}" for "${ref.id}". ` +
        `Add a density value via "gram db enrich" to allow volume/mass conversion.`,
    )
  }
  if (!refUnit && itemUnit) {
    throw new Error(
      `No unit specified for "${ref.id}" but the recipe uses "${itemUnit}". ` +
        `Specify a unit (e.g. --scale ${ref.id}=${ref.value}${itemUnit}).`,
    )
  }

  return ref.value / item.qty
}

// ── Shared warning helper ─────────────────────────────────────────────────────

/** Returns warnings relevant to the given scale factor and recipe. */
export function getScaleWarnings(factor: number, totalTimeMinutes: number): string[] {
  const warnings: string[] = []
  if (factor < 0.1 || factor > 20) {
    warnings.push(`Extreme scale factor (×${factor.toFixed(2)}). Double-check that the result makes sense.`)
  }
  if (totalTimeMinutes > 0) {
    warnings.push('Cooking times are not adjusted automatically.')
  }
  return warnings
}

// ── Comparison builder (for gram scale command) ───────────────────────────────

/**
 * Zips two shopping lists (original + scaled) into a comparison array.
 * The scaled list comes from Kitchen with scaleFactor already applied.
 */
export function buildScaleComparison(original: any[], scaled: any[]): ScaledItem[] {
  const scaledMap = new Map<string, any>(
    scaled
      .filter((i: any) => i.type !== 'composite' && i.type !== 'alternative')
      .map((i: any) => [i.id, i]),
  )

  return original
    .filter((i: any) => i.type !== 'composite' && i.type !== 'alternative')
    .map((i: any): ScaledItem => {
      const scaledItem = scaledMap.get(i.id)
      if (typeof i.qty !== 'number') {
        return { id: i.id, name: i.name, unit: i.unit ?? null, nonScalable: true }
      }
      return {
        id: i.id,
        name: i.name,
        unit: i.unit ?? null,
        originalQty: i.qty,
        scaledQty: typeof scaledItem?.qty === 'number' ? scaledItem.qty : undefined,
      }
    })
}

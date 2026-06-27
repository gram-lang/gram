import { runPipeline } from '../core/pipeline'
import type { IngredientData } from '@gram/analyzer'

export interface ScaledItem {
  id: string
  name?: string
  unit?: string | null
  originalQty?: number
  scaledQty?: number
  nonScalable?: boolean
}

export interface ScaleResult {
  title: string | null
  factor: number
  items: ScaledItem[]
  warnings: string[]
}

interface ParsedRef {
  id: string
  value: number
  unit: string | null
}

export function parseRef(raw: string): ParsedRef {
  const eqIdx = raw.indexOf('=')
  if (eqIdx === -1) {
    throw new Error(`Invalid --ref syntax: "${raw}". Expected id=value (e.g. farine=300g).`)
  }
  const id = raw.slice(0, eqIdx).trim()
  const valueStr = raw.slice(eqIdx + 1).trim()
  const match = valueStr.match(/^([\d.]+)\s*([a-zA-Z%°]*)$/)
  if (!match || !match[1]) {
    throw new Error(
      `Cannot parse quantity "${valueStr}" in --ref. Expected a number with optional unit (e.g. 300g, 200ml, 3).`,
    )
  }
  const value = parseFloat(match[1])
  if (isNaN(value) || value <= 0) {
    throw new Error(`Invalid quantity "${valueStr}" in --ref. Must be a positive number.`)
  }
  const unit = match[2] ? match[2].trim() : null
  return { id, value, unit: unit || null }
}

export async function computeScale(
  filePath: string,
  factorOpt: number | undefined,
  refOpt: string | undefined,
  db: Record<string, IngredientData> | null | undefined,
): Promise<ScaleResult> {
  const { compiled } = await runPipeline(filePath, { db, skipAnalyzer: !db })

  const shoppingList = compiled.shopping_list as any[]
  const warnings: string[] = []
  let factor: number

  if (factorOpt !== undefined) {
    factor = factorOpt
  } else if (refOpt !== undefined) {
    const ref = parseRef(refOpt)
    const item = shoppingList.find(
      (i: any) => i.type !== 'composite' && i.type !== 'alternative' && i.id === ref.id,
    )

    if (!item) {
      const available = shoppingList
        .filter((i: any) => i.type !== 'composite' && i.type !== 'alternative')
        .map((i: any) => i.id)
        .join(', ')
      throw new Error(`Ingredient "${ref.id}" not found in recipe shopping list.\nAvailable: ${available}`)
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
        `No unit specified for "${ref.id}" but recipe uses "${itemUnit}". ` +
          `Specify a unit (e.g. --ref ${ref.id}=${ref.value}${itemUnit}).`,
      )
    }

    factor = ref.value / item.qty
  } else {
    throw new Error('Either --factor or --ref must be provided.')
  }

  if (factor < 0.1 || factor > 20) {
    warnings.push(
      `Extreme scale factor (×${factor.toFixed(2)}). Double-check that the result makes sense.`,
    )
  }

  if (compiled.metrics.totalTime > 0) {
    warnings.push('Cooking times are not adjusted automatically.')
  }

  const items: ScaledItem[] = shoppingList
    .filter((i: any) => i.type !== 'composite' && i.type !== 'alternative')
    .map((i: any) => {
      if (typeof i.qty !== 'number') {
        return { id: i.id, name: i.name, unit: i.unit ?? null, nonScalable: true }
      }
      const raw = i.qty * factor
      // Round to at most 3 significant decimal places to avoid floating-point noise
      const scaledQty = parseFloat(raw.toPrecision(6))
      return { id: i.id, name: i.name, unit: i.unit ?? null, originalQty: i.qty, scaledQty }
    })

  return { title: compiled.title, factor, items, warnings }
}

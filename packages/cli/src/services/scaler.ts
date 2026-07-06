import { log } from '@clack/prompts'
import { runPipeline } from '../core/pipeline'
import { ExitCode } from '../errors'
import { similarity } from '../core/fuzzy'
import type { IngredientData } from '@gram-lang/analyzer'
import { convertUnit, resolveIngredientDensity, parseDensityOverrides } from '@gram-lang/analyzer'
import { resolveScaleFactor as resolveScaleFactorEngine, ScaleError, IngredientNotFoundError } from '@gram-lang/kitchen'

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
 * Resolves a --scale flag value to a numeric scale factor via @gram-lang/kitchen's
 * ScaleEngine — the single place that validates a target ingredient (exists,
 * not fixed/relative/composite/ambiguous) and reconciles units. For ref mode,
 * runs a single unscaled pipeline to read the reference ingredient's quantity.
 *
 * Units within the same physical family (mass<->mass, volume<->volume) always
 * convert. Crossing families (e.g. "water=150g" against a recipe in ml) also
 * works whenever a density is available — from the recipe's own `densities:`
 * frontmatter override, or the ingredient database — resolved once here and
 * handed to the engine as a plain number, so @gram-lang/kitchen never needs to
 * know about ingredient databases or density at all.
 */
export async function resolveScaleFactor(
  filePath: string,
  scale: string,
  db: Record<string, IngredientData> | null | undefined,
): Promise<number> {
  const parsed = parseScaleArg(scale)

  if (parsed.type === 'factor') {
    return resolveScaleFactorEngine(null, { type: 'factor', value: parsed.value }).factor
  }

  const ref = parseRef(parsed.raw)
  const { compiled } = await runPipeline(filePath, { db, skipAnalyzer: !db })

  const overrides = parseDensityOverrides(compiled.meta)
  const density = resolveIngredientDensity(ref.id, db ?? {}, overrides)?.density
  const boundConvertUnit = (value: number, from: string, to: string) => convertUnit(value, from, to, density)

  try {
    return resolveScaleFactorEngine(
      compiled,
      { type: 'target', id: ref.id, qty: ref.value, unit: ref.unit },
      boundConvertUnit,
    ).factor
  } catch (err) {
    if (err instanceof IngredientNotFoundError) {
      const suggestion = closestMatch(err.targetId, err.availableIds)
      const available = err.availableIds.join(', ')
      const hint = suggestion ? ` Did you mean "${suggestion}"?` : ''
      throw new Error(`${err.message}${hint}\nAvailable: ${available}`)
    }
    throw err
  }
}

/** Finds the closest known ingredient id to a mistyped --scale reference, for a "did you mean" hint. */
function closestMatch(id: string, candidates: string[]): string | null {
  const threshold = 0.6
  let best: string | null = null
  let bestScore = 0
  for (const candidate of candidates) {
    const score = similarity(id, candidate)
    if (score >= threshold && score > bestScore) {
      bestScore = score
      best = candidate
    }
  }
  return best
}

/**
 * Convenience wrapper: resolves --scale arg to a factor, logging + exiting on error.
 * Returns undefined when no scale arg is provided (preserves original pipeline behavior).
 */
export async function resolveScaleArg(
  scale: string | undefined,
  filePath: string,
  db: Record<string, IngredientData> | null | undefined,
): Promise<number | undefined> {
  if (!scale) return undefined
  try {
    return await resolveScaleFactor(filePath, scale, db)
  } catch (err) {
    log.error(err instanceof ScaleError || err instanceof Error ? err.message : String(err))
    return process.exit(ExitCode.Error)
  }
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
// Ingredients can appear as several distinct shopping-list entries sharing the
// same id when they're used with incompatible units (e.g. 500g here, 2 cups
// elsewhere) — key by id *and* unit so those rows don't collide in the map.
const comparisonKey = (i: any): string => `${i.id}::${i.unit ?? ''}`

export function buildScaleComparison(original: any[], scaled: any[]): ScaledItem[] {
  const scaledMap = new Map<string, any>(
    scaled
      .filter((i: any) => i.type !== 'composite' && i.type !== 'alternative')
      .map((i: any) => [comparisonKey(i), i]),
  )

  return original
    .filter((i: any) => i.type !== 'composite' && i.type !== 'alternative')
    .map((i: any): ScaledItem => {
      const scaledItem = scaledMap.get(comparisonKey(i))
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

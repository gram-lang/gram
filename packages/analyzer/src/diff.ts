import type {
  CompilationResult,
  ProcessedSection,
  StepToken,
  ProcessedTimer,
  ProcessedTemperature,
  Usage,
  ShoppingListItem,
  CompositeItem,
} from '@gram-lang/kitchen'
import { getNumericQty } from '@gram-lang/kitchen'

// ── Public types ─────────────────────────────────────────────────────────────

export interface MetaDelta {
  field: string
  from: unknown
  to: unknown
}

export interface IngredientDelta {
  id: string
  name: string
  change: 'added' | 'removed' | 'changed'
  fromQty?: number
  fromUnit?: string | null
  toQty?: number
  toUnit?: string | null
  percentChange?: number
}

export interface PrepDelta {
  id: string
  name: string
  section: string | null
  from: string | null
  to: string | null
}

export interface TimingDelta {
  field: 'totalTime' | 'cookTime' | 'activeTime' | 'preparationTime'
  from: number
  to: number
}

export interface SectionDelta {
  change: 'added' | 'removed' | 'changed'
  title: string | null
  fromStepCount?: number
  toStepCount?: number
}

export interface TemperatureDelta {
  section: string | null
  name?: string
  change: 'added' | 'removed' | 'changed'
  from?: { value: number; unit: string; range?: { min: number; max: number } }
  to?: { value: number; unit: string; range?: { min: number; max: number } }
}

export interface TimerDelta {
  section: string | null
  name?: string
  change: 'added' | 'removed' | 'changed'
  from?: string
  to?: string
}

export interface DiffResult {
  hasChanges: boolean
  titleChanged: boolean
  fromTitle: string | null
  toTitle: string | null
  meta: MetaDelta[]
  ingredients: IngredientDelta[]
  preparations: PrepDelta[]
  timings: TimingDelta[]
  sections: SectionDelta[]
  temperatures: TemperatureDelta[]
  timers: TimerDelta[]
}

type ShoppingItem = ShoppingListItem | CompositeItem | Usage
// What's left of ShoppingItem once composite/alternative groups are excluded —
// both ShoppingListItem and Usage share the .name?/.unit?/.qty? shape diffIngredients needs.
type SimpleShoppingItem = ShoppingListItem | Usage

function isCompositeOrAlternative(item: ShoppingItem): item is CompositeItem | (Usage & { type: 'alternative' }) {
  return 'type' in item && (item.type === 'composite' || item.type === 'alternative')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const numericQty = (item: ShoppingItem): number | null => getNumericQty(item.qty)

function fmtTimerQty(qty: ProcessedTimer['quantity'], unit?: string): string {
  const u = unit ? ` ${unit}` : ''
  if (qty === undefined || qty === null) return `?${u}`
  if (typeof qty === 'number') return `${qty}${u}`
  if (typeof qty === 'string') return `${qty}${u}`
  if (typeof qty === 'object') {
    // Pre-existing bug fixed here: this used to check qty.from/qty.to, which
    // never existed on QuantityValueAST (the real range fields are range.min/max),
    // so range timers silently fell through to the plain .value branch below.
    if (qty.type === 'range' && qty.range) return `${qty.range.min}-${qty.range.max}${u}`
    if (qty.value !== undefined) return `${qty.value}${u}`
  }
  return `?${u}`
}

function getTempValue(token: ProcessedTemperature): { value: number; unit: string; range?: { min: number; max: number } } | null {
  const q = token.quantity
  if (!q) return null
  const value = typeof q === 'number' ? q : (typeof q === 'object' && 'value' in q && typeof q.value === 'number' ? q.value : null)
  if (value === null) return null
  // Ranges collapse to their average in `.value` — carry the explicit bounds
  // too, otherwise {2-3} -> {1-4} (same average) would look unchanged.
  const range = typeof q === 'object' && 'type' in q && q.type === 'range' && q.range ? q.range : undefined
  return { value, unit: token.unit ?? '°', range }
}

function isProcessedTimer(token: StepToken): token is ProcessedTimer {
  return typeof token === 'object' && token !== null && 'type' in token && token.type === 'timer'
}

function isProcessedTemperature(token: StepToken): token is ProcessedTemperature {
  return typeof token === 'object' && token !== null && 'type' in token && token.type === 'temperature'
}

// A plain ingredient/cookware/reference usage — the only StepToken variants
// carrying a `.preparation`/`.id` pair relevant to diffPreparations().
// ProcessedDeclaration also has a string `.id`, so it must be excluded
// explicitly — it's the only other StepToken variant that does.
function isUsageToken(token: StepToken): token is Usage {
  return (
    typeof token === 'object' && token !== null &&
    'id' in token && typeof token.id === 'string' &&
    (!('type' in token) || token.type !== 'declaration')
  )
}

// Extract all tokens matching a type predicate from all steps, keyed by section title/position
function extractTokensByType<T extends StepToken>(
  sections: ProcessedSection[],
  isMatch: (token: StepToken) => token is T,
): Map<string, T[]> {
  const result = new Map<string, T[]>()
  sections.forEach((section, i) => {
    const key = section.title ?? `__pos_${i}`
    const tokens: T[] = []
    for (const step of section.steps ?? []) {
      if (step.type !== 'step') continue
      for (const token of step.content ?? []) {
        if (isMatch(token)) tokens.push(token)
      }
    }
    if (tokens.length > 0) {
      // Two sections can share the same title (or both be untitled and fall
      // on the same fallback... no — untitled sections get a unique
      // `__pos_${i}` key). Duplicate *titled* sections must accumulate here
      // rather than overwrite, otherwise the second section's tokens would
      // silently replace — and hide from the diff — the first's.
      const existing = result.get(key)
      if (existing) existing.push(...tokens)
      else result.set(key, tokens)
    }
  })
  return result
}

// Match tokens: named by name, unnamed by position
function matchTokenPairs<T extends { name?: string }>(aTokens: T[], bTokens: T[]): Array<[T | null, T | null]> {
  const pairs: Array<[T | null, T | null]> = []

  const aNamed = new Map<string, T>(); const aUnnamed: T[] = []
  for (const t of aTokens) { t.name ? aNamed.set(t.name, t) : aUnnamed.push(t) }

  const bNamed = new Map<string, T>(); const bUnnamed: T[] = []
  for (const t of bTokens) { t.name ? bNamed.set(t.name, t) : bUnnamed.push(t) }

  for (const name of new Set([...aNamed.keys(), ...bNamed.keys()])) {
    pairs.push([aNamed.get(name) ?? null, bNamed.get(name) ?? null])
  }

  const maxLen = Math.max(aUnnamed.length, bUnnamed.length)
  for (let i = 0; i < maxLen; i++) pairs.push([aUnnamed[i] ?? null, bUnnamed[i] ?? null])

  return pairs
}

// ── Diff functions ────────────────────────────────────────────────────────────

function diffMeta(a: Record<string, unknown>, b: Record<string, unknown>): MetaDelta[] {
  const skipKeys = new Set(['title'])
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)].filter(k => !skipKeys.has(k)))
  const deltas: MetaDelta[] = []
  for (const field of allKeys) {
    const from = a[field] ?? null
    const to = b[field] ?? null
    if (JSON.stringify(from) !== JSON.stringify(to)) deltas.push({ field, from, to })
  }
  return deltas
}

function diffIngredients(a: ShoppingItem[], b: ShoppingItem[]): IngredientDelta[] {
  const toMap = (list: ShoppingItem[]) =>
    new Map<string, SimpleShoppingItem>(
      list.filter((i): i is SimpleShoppingItem => !isCompositeOrAlternative(i)).map(i => [i.id, i]),
    )

  const aMap = toMap(a)
  const bMap = toMap(b)
  const allIds = new Set([...aMap.keys(), ...bMap.keys()])
  const deltas: IngredientDelta[] = []

  for (const id of allIds) {
    const aItem = aMap.get(id)
    const bItem = bMap.get(id)

    if (aItem && !bItem) {
      deltas.push({ id, name: aItem.name || id, change: 'removed', fromQty: numericQty(aItem) ?? undefined, fromUnit: aItem.unit ?? null })
      continue
    }
    if (!aItem && bItem) {
      deltas.push({ id, name: bItem.name || id, change: 'added', toQty: numericQty(bItem) ?? undefined, toUnit: bItem.unit ?? null })
      continue
    }
    if (!aItem || !bItem) continue

    const aQty = numericQty(aItem); const bQty = numericQty(bItem)
    const aUnit = aItem.unit ?? null; const bUnit = bItem.unit ?? null

    if (aQty === bQty && aUnit === bUnit) continue

    const delta: IngredientDelta = {
      id,
      name: bItem.name || id,
      change: 'changed',
      fromQty: aQty ?? undefined,
      fromUnit: aUnit,
      toQty: bQty ?? undefined,
      toUnit: bUnit,
    }

    if (aQty !== null && bQty !== null && aUnit === bUnit && aQty !== 0) {
      delta.percentChange = Math.round(((bQty - aQty) / aQty) * 100)
    }

    deltas.push(delta)
  }

  return deltas
}

function diffTimings(a: CompilationResult['metrics'], b: CompilationResult['metrics']): TimingDelta[] {
  const fields: Array<keyof CompilationResult['metrics']> = ['totalTime', 'cookTime', 'activeTime', 'preparationTime']
  const deltas: TimingDelta[] = []
  for (const field of fields) {
    const from = a[field] ?? 0
    const to = b[field] ?? 0
    if (from !== to) deltas.push({ field: field as TimingDelta['field'], from, to })
  }
  return deltas
}

function stepCount(section: ProcessedSection): number {
  return (section.steps ?? []).filter(s => s.type === 'step').length
}

function diffSections(a: ProcessedSection[], b: ProcessedSection[]): SectionDelta[] {
  const byTitle = (list: ProcessedSection[]) => {
    const m = new Map<string, ProcessedSection>()
    list.forEach((s, i) => { m.set(s.title ?? `__pos_${i}`, s) })
    return m
  }

  const aMap = byTitle(a); const bMap = byTitle(b)
  const allKeys = new Set([...aMap.keys(), ...bMap.keys()])
  const deltas: SectionDelta[] = []

  for (const key of allKeys) {
    const aSection = aMap.get(key); const bSection = bMap.get(key)

    if (aSection && !bSection) {
      deltas.push({ change: 'removed', title: aSection.title, fromStepCount: stepCount(aSection) })
      continue
    }
    if (!aSection && bSection) {
      deltas.push({ change: 'added', title: bSection.title, toStepCount: stepCount(bSection) })
      continue
    }
    if (!aSection || !bSection) continue

    const from = stepCount(aSection); const to = stepCount(bSection)
    if (from !== to) deltas.push({ change: 'changed', title: bSection.title, fromStepCount: from, toStepCount: to })
  }

  return deltas
}

function diffTemperatures(aSections: ProcessedSection[], bSections: ProcessedSection[]): TemperatureDelta[] {
  const aMap = extractTokensByType(aSections, isProcessedTemperature)
  const bMap = extractTokensByType(bSections, isProcessedTemperature)
  const allKeys = new Set([...aMap.keys(), ...bMap.keys()])
  const deltas: TemperatureDelta[] = []

  for (const key of allKeys) {
    const sectionTitle = key.startsWith('__pos_') ? null : key
    const pairs = matchTokenPairs(aMap.get(key) ?? [], bMap.get(key) ?? [])

    for (const [a, b] of pairs) {
      if (!a && b) {
        const to = getTempValue(b)
        if (to) deltas.push({ section: sectionTitle, name: b.name, change: 'added', to })
        continue
      }
      if (a && !b) {
        const from = getTempValue(a)
        if (from) deltas.push({ section: sectionTitle, name: a.name, change: 'removed', from })
        continue
      }
      if (a && b) {
        const from = getTempValue(a); const to = getTempValue(b)
        const nameChanged = (a.name ?? null) !== (b.name ?? null)
        const valChanged = JSON.stringify(from) !== JSON.stringify(to)
        if (nameChanged || valChanged) {
          deltas.push({ section: sectionTitle, name: b.name ?? a.name, change: 'changed', from: from ?? undefined, to: to ?? undefined })
        }
      }
    }
  }

  return deltas
}

function diffTimers(aSections: ProcessedSection[], bSections: ProcessedSection[]): TimerDelta[] {
  const aMap = extractTokensByType(aSections, isProcessedTimer)
  const bMap = extractTokensByType(bSections, isProcessedTimer)
  const allKeys = new Set([...aMap.keys(), ...bMap.keys()])
  const deltas: TimerDelta[] = []

  for (const key of allKeys) {
    const sectionTitle = key.startsWith('__pos_') ? null : key
    const pairs = matchTokenPairs(aMap.get(key) ?? [], bMap.get(key) ?? [])

    for (const [a, b] of pairs) {
      if (!a && b) {
        deltas.push({ section: sectionTitle, name: b.name, change: 'added', to: fmtTimerQty(b.quantity, b.unit) })
        continue
      }
      if (a && !b) {
        deltas.push({ section: sectionTitle, name: a.name, change: 'removed', from: fmtTimerQty(a.quantity, a.unit) })
        continue
      }
      if (a && b) {
        const from = fmtTimerQty(a.quantity, a.unit); const to = fmtTimerQty(b.quantity, b.unit)
        const nameChanged = (a.name ?? null) !== (b.name ?? null)
        if (nameChanged || from !== to) {
          deltas.push({ section: sectionTitle, name: b.name ?? a.name, change: 'changed', from, to })
        }
      }
    }
  }

  return deltas
}

const SKIP_TOKEN_TYPES = new Set(['declaration', 'timer', 'temperature', 'comment', 'alternative', 'composite'])

function diffPreparations(aSections: ProcessedSection[], bSections: ProcessedSection[]): PrepDelta[] {
  const extractBySection = (sections: ProcessedSection[]) => {
    const result = new Map<string, Map<string, Usage[]>>()
    sections.forEach((section, i) => {
      const key = section.title ?? `__pos_${i}`
      const byId = new Map<string, Usage[]>()
      for (const step of section.steps ?? []) {
        if (step.type !== 'step') continue
        for (const token of step.content ?? []) {
          if (!isUsageToken(token)) continue
          if (token.type && SKIP_TOKEN_TYPES.has(token.type)) continue
          const bucket = byId.get(token.id) ?? []
          bucket.push(token)
          byId.set(token.id, bucket)
        }
      }
      result.set(key, byId)
    })
    return result
  }

  const aMap = extractBySection(aSections)
  const bMap = extractBySection(bSections)
  const allKeys = new Set([...aMap.keys(), ...bMap.keys()])
  const deltas: PrepDelta[] = []

  for (const key of allKeys) {
    const sectionTitle = key.startsWith('__pos_') ? null : key
    const aById = aMap.get(key) ?? new Map<string, Usage[]>()
    const bById = bMap.get(key) ?? new Map<string, Usage[]>()
    const allIds = new Set([...aById.keys(), ...bById.keys()])

    for (const id of allIds) {
      const aOccurrences = aById.get(id) ?? []
      const bOccurrences = bById.get(id) ?? []
      const maxLen = Math.max(aOccurrences.length, bOccurrences.length)

      for (let i = 0; i < maxLen; i++) {
        const a = aOccurrences[i] ?? null
        const b = bOccurrences[i] ?? null
        const aPrep = a?.preparation ?? null
        const bPrep = b?.preparation ?? null
        if (aPrep === bPrep) continue
        deltas.push({ id, name: (b ?? a)?.name ?? id, section: sectionTitle, from: aPrep, to: bPrep })
      }
    }
  }

  return deltas
}

// ── Main export ───────────────────────────────────────────────────────────────

export function diffRecipes(a: CompilationResult, b: CompilationResult): DiffResult {
  const ingredients = diffIngredients(a.shopping_list ?? [], b.shopping_list ?? [])
  const preparations = diffPreparations(a.sections ?? [], b.sections ?? [])
  const timings = diffTimings(a.metrics, b.metrics)
  const sections = diffSections(a.sections ?? [], b.sections ?? [])
  const meta = diffMeta((a.meta ?? {}) as Record<string, unknown>, (b.meta ?? {}) as Record<string, unknown>)
  const temperatures = diffTemperatures(a.sections ?? [], b.sections ?? [])
  const timers = diffTimers(a.sections ?? [], b.sections ?? [])
  const titleChanged = a.title !== b.title

  return {
    hasChanges: titleChanged || ingredients.length > 0 || preparations.length > 0 || timings.length > 0
      || sections.length > 0 || meta.length > 0 || temperatures.length > 0 || timers.length > 0,
    titleChanged,
    fromTitle: a.title,
    toTitle: b.title,
    meta,
    ingredients,
    preparations,
    timings,
    sections,
    temperatures,
    timers,
  }
}

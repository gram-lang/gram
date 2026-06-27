import type { CompilationResult } from '@gram/kitchen'

// ── Public types ─────────────────────────────────────────────────────────────

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

export interface TimingDelta {
  field: 'totalTime' | 'activeTime' | 'preparationTime'
  from: number
  to: number
}

export interface SectionDelta {
  change: 'added' | 'removed' | 'changed'
  title: string | null
  fromStepCount?: number
  toStepCount?: number
}

export interface DiffResult {
  hasChanges: boolean
  titleChanged: boolean
  fromTitle: string | null
  toTitle: string | null
  ingredients: IngredientDelta[]
  timings: TimingDelta[]
  sections: SectionDelta[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function numericQty(item: any): number | null {
  const q = item.qty
  if (typeof q === 'number') return q
  if (q && typeof q === 'object') {
    if (q.type === 'single' && typeof q.value === 'number') return q.value
    if ((q.type === 'fraction' || q.type === 'range') && typeof q.value === 'number') return q.value
  }
  return null
}

function diffIngredients(a: any[], b: any[]): IngredientDelta[] {
  const toMap = (list: any[]) =>
    new Map<string, any>(
      list
        .filter(i => i.type !== 'composite' && i.type !== 'alternative')
        .map(i => [i.id, i]),
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

    // Both present — check for change
    const aQty = numericQty(aItem)
    const bQty = numericQty(bItem)
    const aUnit = aItem.unit ?? null
    const bUnit = bItem.unit ?? null

    const qtyChanged = aQty !== bQty
    const unitChanged = aUnit !== bUnit

    if (!qtyChanged && !unitChanged) continue

    const delta: IngredientDelta = {
      id,
      name: bItem.name || id,
      change: 'changed',
      fromQty: aQty ?? undefined,
      fromUnit: aUnit,
      toQty: bQty ?? undefined,
      toUnit: bUnit,
    }

    if (aQty !== null && bQty !== null && !unitChanged && aQty !== 0) {
      delta.percentChange = Math.round(((bQty - aQty) / aQty) * 100)
    }

    deltas.push(delta)
  }

  return deltas
}

function diffTimings(
  a: CompilationResult['metrics'],
  b: CompilationResult['metrics'],
): TimingDelta[] {
  const fields: Array<keyof CompilationResult['metrics']> = ['totalTime', 'activeTime', 'preparationTime']
  const deltas: TimingDelta[] = []

  for (const field of fields) {
    const from = a[field] ?? 0
    const to = b[field] ?? 0
    if (from !== to) {
      deltas.push({ field: field as TimingDelta['field'], from, to })
    }
  }

  return deltas
}

function stepCount(section: any): number {
  return (section.steps ?? []).filter((s: any) => s.type === 'step').length
}

function diffSections(a: any[], b: any[]): SectionDelta[] {
  const deltas: SectionDelta[] = []

  // Build title→section maps; handle null titles by position
  const byTitle = (list: any[]) => {
    const m = new Map<string, any>()
    list.forEach((s, i) => m.set(s.title ?? `__pos_${i}`, s))
    return m
  }

  const aMap = byTitle(a)
  const bMap = byTitle(b)
  const allKeys = new Set([...aMap.keys(), ...bMap.keys()])

  for (const key of allKeys) {
    const aSection = aMap.get(key)
    const bSection = bMap.get(key)

    if (aSection && !bSection) {
      deltas.push({ change: 'removed', title: aSection.title, fromStepCount: stepCount(aSection) })
      continue
    }
    if (!aSection && bSection) {
      deltas.push({ change: 'added', title: bSection.title, toStepCount: stepCount(bSection) })
      continue
    }

    const from = stepCount(aSection)
    const to = stepCount(bSection)
    if (from !== to) {
      deltas.push({ change: 'changed', title: bSection.title, fromStepCount: from, toStepCount: to })
    }
  }

  return deltas
}

// ── Main export ───────────────────────────────────────────────────────────────

export function diffRecipes(a: CompilationResult, b: CompilationResult): DiffResult {
  const ingredients = diffIngredients(a.shopping_list ?? [], b.shopping_list ?? [])
  const timings = diffTimings(a.metrics, b.metrics)
  const sections = diffSections(a.sections ?? [], b.sections ?? [])
  const titleChanged = a.title !== b.title

  return {
    hasChanges: titleChanged || ingredients.length > 0 || timings.length > 0 || sections.length > 0,
    titleChanged,
    fromTitle: a.title,
    toTitle: b.title,
    ingredients,
    timings,
    sections,
  }
}

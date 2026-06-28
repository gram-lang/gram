import type { CompilationResult } from '@gram/kitchen'

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

export interface TemperatureDelta {
  section: string | null
  name?: string
  change: 'added' | 'removed' | 'changed'
  from?: { value: number; unit: string }
  to?: { value: number; unit: string }
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

function fmtTimerQty(qty: any, unit?: string): string {
  const u = unit ? ` ${unit}` : ''
  if (qty === undefined || qty === null) return `?${u}`
  if (typeof qty === 'number') return `${qty}${u}`
  if (typeof qty === 'string') return `${qty}${u}`
  if (typeof qty === 'object') {
    if (qty.type === 'range' && qty.from !== undefined && qty.to !== undefined) return `${qty.from}-${qty.to}${u}`
    if (qty.value !== undefined) return `${qty.value}${u}`
  }
  return `?${u}`
}

function getTempValue(token: any): { value: number; unit: string } | null {
  const q = token.quantity
  if (!q) return null
  const value = typeof q === 'number' ? q : (typeof q?.value === 'number' ? q.value : null)
  if (value === null) return null
  return { value, unit: token.unit ?? '°' }
}

// Extract all tokens of a given type from all steps, keyed by section title/position
function extractTokensByType(sections: any[], tokenType: string): Map<string, any[]> {
  const result = new Map<string, any[]>()
  sections.forEach((section, i) => {
    const key = section.title ?? `__pos_${i}`
    const tokens: any[] = []
    for (const step of (section.steps ?? []) as any[]) {
      if (step.type !== 'step') continue
      for (const token of (step.content ?? []) as any[]) {
        if (token && typeof token === 'object' && token.type === tokenType) tokens.push(token)
      }
    }
    if (tokens.length > 0) result.set(key, tokens)
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

function diffIngredients(a: any[], b: any[]): IngredientDelta[] {
  const toMap = (list: any[]) =>
    new Map<string, any>(
      list.filter(i => i.type !== 'composite' && i.type !== 'alternative').map(i => [i.id, i]),
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
  const fields: Array<keyof CompilationResult['metrics']> = ['totalTime', 'activeTime', 'preparationTime']
  const deltas: TimingDelta[] = []
  for (const field of fields) {
    const from = a[field] ?? 0
    const to = b[field] ?? 0
    if (from !== to) deltas.push({ field: field as TimingDelta['field'], from, to })
  }
  return deltas
}

function stepCount(section: any): number {
  return (section.steps ?? []).filter((s: any) => s.type === 'step').length
}

function diffSections(a: any[], b: any[]): SectionDelta[] {
  const byTitle = (list: any[]) => {
    const m = new Map<string, any>()
    list.forEach((s, i) => m.set(s.title ?? `__pos_${i}`, s))
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

    const from = stepCount(aSection); const to = stepCount(bSection)
    if (from !== to) deltas.push({ change: 'changed', title: bSection.title, fromStepCount: from, toStepCount: to })
  }

  return deltas
}

function diffTemperatures(aSections: any[], bSections: any[]): TemperatureDelta[] {
  const aMap = extractTokensByType(aSections, 'temperature')
  const bMap = extractTokensByType(bSections, 'temperature')
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

function diffTimers(aSections: any[], bSections: any[]): TimerDelta[] {
  const aMap = extractTokensByType(aSections, 'timer')
  const bMap = extractTokensByType(bSections, 'timer')
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

function diffPreparations(aSections: any[], bSections: any[]): PrepDelta[] {
  const extractBySection = (sections: any[]) => {
    const result = new Map<string, Map<string, any[]>>()
    sections.forEach((section, i) => {
      const key = section.title ?? `__pos_${i}`
      const byId = new Map<string, any[]>()
      for (const step of (section.steps ?? []) as any[]) {
        if (step.type !== 'step') continue
        for (const token of (step.content ?? []) as any[]) {
          if (!token || typeof token !== 'object' || typeof token.id !== 'string') continue
          if (SKIP_TOKEN_TYPES.has(token.type)) continue
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
    const aById = aMap.get(key) ?? new Map<string, any[]>()
    const bById = bMap.get(key) ?? new Map<string, any[]>()
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

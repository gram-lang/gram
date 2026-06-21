import { basename } from 'node:path'
import { runPipeline } from '../core/pipeline'
import { fmtNumber } from '../core/format'
import type { IngredientData } from '@gram/analyzer'
import type { RecipeViewModel } from '../types'

function formatMass(grams: number): string {
  if (grams >= 1000) return `${fmtNumber(grams / 1000)} kg`
  return `${fmtNumber(Math.round(grams), 0)} g`
}

function formatQty(item: any): string {
  const qty = item.qty
  if (qty == null) return ''
  if (typeof qty === 'number') {
    return item.unit ? `${fmtNumber(qty)} ${item.unit}` : fmtNumber(qty)
  }
  if (typeof qty === 'string') return item.unit ? `${qty} ${item.unit}` : qty
  if (typeof qty === 'object') {
    if (qty.value === 'TextQuantity' || qty.type === 'text') return qty.value ?? ''
    if (qty.text) return item.unit ? `${qty.text} ${item.unit}` : qty.text
    if (qty.value != null) {
      const v = typeof qty.value === 'number' ? fmtNumber(qty.value) : String(qty.value)
      return item.unit ? `${v} ${item.unit}` : v
    }
    if (qty.range) {
      const min = typeof qty.range.min === 'number' ? fmtNumber(qty.range.min) : qty.range.min
      const max = typeof qty.range.max === 'number' ? fmtNumber(qty.range.max) : qty.range.max
      const r = `${min}–${max}`
      return item.unit ? `${r} ${item.unit}` : r
    }
  }
  return ''
}

function tokenToText(item: any, registry: Record<string, any>): string {
  if (typeof item === 'string') return item
  if (!item) return ''
  if (item.id && (!item.type || item.type === 'ingredient' || item.type === 'cookware' || item.type === 'reference')) {
    return item.alias ?? registry[item.id]?.name ?? item.name ?? item.id
  }
  switch (item.type) {
    case 'text': return item.value ?? ''
    case 'timer': {
      const q = item.quantity
      if (!q) return ''
      const val = q.text ?? (q.value != null ? String(q.value) : '')
      return `~${val}${q.unit ?? 'min'}`
    }
    case 'temperature': {
      const q = item.quantity
      if (!q) return item.text ?? ''
      const val = q.text ?? (q.value != null ? String(q.value) : '')
      return `${val}${item.unit ?? '°C'}`
    }
    case 'comment':
    case 'declaration':
      return ''
    default:
      return item.value ?? item.name ?? ''
  }
}

function isInlineToken(item: any): boolean {
  if (typeof item === 'string') return false
  if (!item) return false
  if (item.type === 'comment' || item.type === 'declaration') return false
  return true
}

function stepToText(content: any[], registry: Record<string, any>): string {
  const parts: string[] = []
  for (let i = 0; i < content.length; i++) {
    const item = content[i]
    const text = tokenToText(item, registry)
    if (!text) continue

    if (isInlineToken(item) && parts.length > 0) {
      const last = parts[parts.length - 1]
      // Don't add space if preceded by apostrophe or whitespace
      if (last && !/[\s']$/.test(last)) parts.push(' ')
    }

    parts.push(text)

    if (isInlineToken(item)) {
      const next = content[i + 1]
      const nextText = next ? (typeof next === 'string' ? next : tokenToText(next, registry)) : ''
      if (nextText && !/^[\s.,!?:;)]/.test(nextText)) parts.push(' ')
    }
  }
  return parts.join('').trim()
}

function getTimerMinutes(step: any): number | undefined {
  const tasks: any[] = step.backgroundTasks ?? []
  if (tasks.length > 0) return tasks[0].duration
  return undefined
}

export async function buildViewModel(
  file: string,
  opts: { db?: Record<string, IngredientData> | null },
): Promise<RecipeViewModel> {
  const { compiled, analyzed } = await runPipeline(file, { db: opts.db })

  const title = (compiled.meta?.title as string | undefined) ?? compiled.title ?? basename(file, '.gram')
  const servings = (compiled.meta?.servings as number | undefined) ?? null

  const m = compiled.metrics
  const times =
    m.totalTime || m.activeTime || m.preparationTime
      ? {
          active: m.activeTime || undefined,
          prep: m.preparationTime || undefined,
          total: m.totalTime || undefined,
        }
      : null

  const registry = compiled.registry?.ingredients ?? {}

  // Shopping list
  const shoppingList: RecipeViewModel['shoppingList'] = []
  if (analyzed) {
    for (const item of analyzed.result.shopping_list as any[]) {
      if (item.type === 'alternative' || item.variable_entries) continue
      const name = opts.db?.[item.id]?.name ?? item.name ?? item.id
      if (item.normalizedMass != null) {
        shoppingList.push({
          name,
          displayQty: formatMass(item.normalizedMass),
          isEstimate: item.isEstimate ?? false,
        })
      } else {
        const qty = formatQty(item)
        if (qty) shoppingList.push({ name, displayQty: qty, isEstimate: false })
      }
    }
  } else {
    for (const item of compiled.shopping_list as any[]) {
      if (item.type === 'alternative' || item.variable_entries) continue
      const qty = formatQty(item)
      if (qty) {
        shoppingList.push({ name: item.name ?? item.id, displayQty: qty, isEstimate: false })
      }
    }
  }

  // Sections
  const sourceSections: any[] = analyzed ? analyzed.result.sections : compiled.sections
  const sections: RecipeViewModel['sections'] = sourceSections.map(sec => {
    const ingredients: RecipeViewModel['sections'][0]['ingredients'] = (
      (sec.ingredients ?? []) as any[]
    )
      .filter((ing: any) => ing.type !== 'alternative' && ing.qty != null)
      .map((ing: any) => {
        const name = opts.db?.[ing.id]?.name ?? ing.alias ?? registry[ing.id]?.name ?? ing.name ?? ing.id
        if (ing.normalizedMass != null) {
          return { name, displayQty: formatMass(ing.normalizedMass), isEstimate: ing.isEstimate ?? false }
        }
        const qty = formatQty(ing)
        return { name, displayQty: qty, isEstimate: false }
      })

    const steps: RecipeViewModel['sections'][0]['steps'] = []
    for (const step of (sec.steps ?? []) as any[]) {
      if (step.type === 'comment') continue
      const text = stepToText(step.content ?? [], registry)
      if (!text) continue
      steps.push({
        action: step.action ?? undefined,
        text,
        timerMinutes: getTimerMinutes(step),
      })
    }

    return { title: sec.title ?? null, ingredients, steps }
  })

  const nutrition = analyzed?.result.metrics?.nutrition ?? null
  const missingIngredients = analyzed?.missingIngredients ?? []

  return { title, servings, times, shoppingList, sections, nutrition, missingIngredients }
}

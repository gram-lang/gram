import type { CompilationResult } from '@gram/kitchen'
import type { RecipeData, FlatStep, CookTimer } from './types'

function quantityToMs(qty: any): number {
  if (!qty) return 0
  const val = typeof qty.value === 'object' ? qty.value?.value : qty.value
  const num = typeof val === 'number' ? val : 0
  const unit = (qty.unit ?? 'min').toLowerCase()
  if (unit === 'h' || unit === 'hr' || unit === 'heure' || unit === 'heures') return num * 60 * 60 * 1000
  if (unit === 's' || unit === 'sec') return num * 1000
  return num * 60 * 1000 // default minutes
}

function extractTimers(step: any, sectionIdx: number, stepIdx: number): CookTimer[] {
  const timers: CookTimer[] = []
  const seen = new Set<string>()

  // 1. backgroundTasks (async timers ~&name{})
  if (Array.isArray(step.backgroundTasks)) {
    step.backgroundTasks.forEach((t: any, i: number) => {
      const id = `${sectionIdx}-${stepIdx}-bg-${i}`
      const name = t.name ?? `Timer step ${stepIdx + 1}`
      if (!seen.has(name)) {
        seen.add(name)
        timers.push({ id, name, durationMs: (t.duration ?? 0) * 60 * 1000 })
      }
    })
  }

  // 2. inline timer tokens in content (~name{})
  if (Array.isArray(step.content)) {
    step.content.forEach((token: any, i: number) => {
      if (token?.type !== 'timer') return
      // Skip async timers already captured above (isAsync flag)
      if (token.isAsync) return
      const name = token.name ?? `Timer step ${stepIdx + 1}`
      if (seen.has(name)) return
      seen.add(name)
      const id = `${sectionIdx}-${stepIdx}-inline-${i}`
      timers.push({ id, name, durationMs: quantityToMs(token.quantity) })
    })
  }

  return timers.filter(t => t.durationMs > 0)
}

export function prepareRecipeData(compiled: CompilationResult): RecipeData {
  const steps: FlatStep[] = []
  let globalIndex = 0

  compiled.sections.forEach((section, sectionIdx) => {
    const sectionSteps = (section.steps ?? []).filter((s: any) => s.type === 'step')
    sectionSteps.forEach((step: any, localIdx: number) => {
      steps.push({
        globalIndex,
        sectionIndex: sectionIdx,
        sectionTitle: section.title,
        isFirstOfSection: localIdx === 0,
        sectionIngredients: section.ingredients ?? [],
        step,
        timers: extractTimers(step, sectionIdx, globalIndex),
      })
      globalIndex++
    })
  })

  return {
    title: compiled.title,
    shoppingList: compiled.shopping_list ?? [],
    steps,
    registry: compiled.registry,
  }
}

// Convert step content tokens to a plain-text instruction string
export function stepToText(content: any[], registry: CompilationResult['registry']): string {
  const parts: string[] = []
  for (const token of content) {
    if (typeof token === 'string') { parts.push(token); continue }
    if (!token) continue
    if (token.type === 'comment' || token.type === 'declaration') continue
    if (token.type === 'reference') {
      parts.push(registry.ingredients[token.id]?.name ?? token.name ?? token.id)
      continue
    }
    if (token.type === 'timer') {
      const q = token.quantity
      const val = q?.text ?? (q?.value != null ? String(typeof q.value === 'object' ? q.value.value : q.value) : '')
      parts.push(`~${val}${q?.unit ?? 'min'}`)
      continue
    }
    if (token.type === 'temperature') {
      const q = token.quantity
      const val = q?.text ?? (q?.value != null ? String(typeof q.value === 'object' ? q.value.value : q.value) : '')
      parts.push(`${val}${token.unit ?? '°'}`)
      continue
    }
    if (token.id) {
      parts.push(token.alias ?? registry.ingredients[token.id]?.name ?? registry.cookware?.[token.id]?.name ?? token.name ?? token.id)
      continue
    }
    if (token.value != null) parts.push(String(token.value))
  }
  return parts.join('').trim()
}

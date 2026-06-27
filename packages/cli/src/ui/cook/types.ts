import type { CompilationResult } from '@gram/kitchen'

export interface CookTimer {
  id: string
  name: string
  durationMs: number
}

export interface ActiveTimer extends CookTimer {
  startedAt: number
  done: boolean
}

export interface FlatStep {
  globalIndex: number
  sectionIndex: number
  sectionTitle: string | null
  isFirstOfSection: boolean
  sectionIngredients: any[]
  step: any // ProcessedStep
  timers: CookTimer[]
}

export interface RecipeData {
  title: string | null
  shoppingList: any[]
  steps: FlatStep[]
  registry: CompilationResult['registry']
}

export type Phase = 'mise-en-place' | 'section-start' | 'cooking' | 'end'

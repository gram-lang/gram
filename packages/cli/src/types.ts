import type { IngredientData } from '@gram/analyzer'

export type DiagnosticLevel = 'error' | 'warning' | 'info'

export interface Diagnostic {
  level: DiagnosticLevel
  category: 'Structure' | 'Database'
  file: string
  message: string
  line?: number
  col?: number
}

export interface CheckResult {
  diagnostics: Diagnostic[]
  hasErrors: boolean
  fileCount: number
}

export interface BuildResult {
  slug: string
  file: string
  data: object
}

export interface RecipeViewModel {
  title: string
  servings: number | null
  times: {
    active?: number
    prep?: number
    rest?: number
    total?: number
  }
  shoppingList: Array<{ name: string; quantity: string; unit?: string }>
  sections: Array<{ title: string | null; steps: string[] }>
}

export interface GramConfig {
  version?: number
  database?: string
  language?: string
  ai?: {
    provider: string
    apiKey?: string
    model?: string
  }
}

export interface PipelineOptions {
  db?: Record<string, IngredientData> | null
  skipAnalyzer?: boolean
}

export interface CheckOptions {
  db?: Record<string, IngredientData> | null
}

export interface BuildOptions {
  db?: Record<string, IngredientData> | null
  pretty?: boolean
}

import type { IngredientData, NutritionMetrics } from '@gram/analyzer'

export type { NutritionMetrics }

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

// --- Phase 2 types ---

export interface DbSyncOptions {
  dryRun?: boolean
  dbPathOverride?: string
}

export interface DbSyncResult {
  dbPath: string
  totalFound: number
  newIngredients: string[]
  existingIngredients: string[]
}

export interface DbIssue {
  level: 'error' | 'warning'
  category: string
  ingredient?: string
  message: string
}

export interface DbValidateResult {
  dbPath: string
  ingredientCount: number
  issues: DbIssue[]
  hasErrors: boolean
}

export interface ShoppingEntry {
  id: string
  name: string
  displayQty: string
  isEstimate: boolean
  recipes: string[]
  category: string
  cannotAggregate: boolean
}

export interface ShopResult {
  items: ShoppingEntry[]
  byCategory: Map<string, ShoppingEntry[]>
  warnings: string[]
  recipeCount: number
}

// --- Phase 3 types ---

export interface RecipeViewModel {
  title: string
  servings: number | null
  times: { active?: number; prep?: number; rest?: number; total?: number } | null
  shoppingList: Array<{ name: string; displayQty: string; isEstimate: boolean }>
  sections: Array<{
    title: string | null
    ingredients: Array<{ name: string; displayQty: string; isEstimate: boolean }>
    steps: Array<{ action?: string; text: string; timerMinutes?: number }>
  }>
  nutrition: NutritionMetrics | null
  missingIngredients: string[]
}

export interface ImportResult {
  gramContent: string
  title: string
  ingredientCount: number
  stepCount: number
  parseWarnings: string[]
}

export interface EnrichEntry {
  id: string
  name: string
  density?: number
  unit_weight?: number
  nutrition?: {
    calories: number
    carbs: number
    protein: number
    fat: number
    sugar?: number
    sat_fat?: number
    fiber?: number
    sodium?: number
  }
  tagSuggestions: string[]
}

export interface EnrichResult {
  dbPath: string
  totalIncomplete: number
  enriched: EnrichEntry[]
  skipped: string[]
  failed: string[]
}

export interface EnrichOptions {
  ingredient?: string
  field?: 'density' | 'nutrition' | 'all'
  dryRun?: boolean
  dbPathOverride?: string
  onBatchDone?: (done: number, total: number, enriched: string[], failed: string[]) => void
}

export interface GramConfig {
  version?: number
  database?: string
  language?: string
  ai?: {
    provider?: string
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

import pLimit from 'p-limit'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, dirname, join } from 'node:path'
import { parseDocument, isMap } from 'yaml'
import { z } from 'zod'
import { generateObject } from 'ai'
import type { LanguageModel } from 'ai'
import type { IngredientData } from '@gram/analyzer'
import { withFileLock, atomicWrite } from '../core/lock'
import type { GramConfig, EnrichEntry, EnrichResult, EnrichOptions } from '../types'

const SYSTEM_PROMPT =
  'You are a culinary database assistant. For each ingredient provided, return accurate physical and nutritional data based on standard food science references. Use SI units: density in g/mL, nutrition per 100g of edible portion. If an ingredient is typically used in countable units (like a carrot, an egg), provide its average unit_weight in grams. Choose exactly one "aisle" (supermarket aisle). Then provide other useful free-form "tagSuggestions" (e.g., vegan, gluten-free, allergen, etc.).'

const AISLES = [
  'Fruits & Vegetables',
  'Meat & Seafood',
  'Dairy & Eggs',
  'Bakery',
  'Sweet Groceries',
  'Savory Groceries',
  'Beverages',
  'Frozen Foods',
  'Fresh Foods',
  'Dry Goods',
  'Other',
] as const

const EnrichItemSchema = z.object({
  key: z.string(),
  density: z.number().max(5).optional(),
  unit_weight: z.number().optional(),
  nutrition: z
    .object({
      calories: z.number().max(1000),
      carbs: z.number().min(0),
      protein: z.number().min(0),
      fat: z.number().min(0),
      sugar: z.number().min(0).optional(),
      sat_fat: z.number().min(0).optional(),
      fiber: z.number().min(0).optional(),
      sodium: z.number().min(0).optional(),
    })
    .optional(),
  aisle: z.enum(AISLES).default('Autre'),
  tagSuggestions: z.array(z.string()).default([]),
})

const EnrichResponseSchema = z.object({
  ingredients: z.array(EnrichItemSchema),
})

function resolveDbPath(config: GramConfig, override?: string): string {
  const root = config.projectRoot ?? process.cwd()
  if (override) return resolve(override)
  if (config.database) return resolve(root, config.database)
  return join(root, '.gram', 'ingredients.yaml')
}

export async function enrichDb(
  db: Record<string, IngredientData>,
  config: GramConfig,
  model: LanguageModel,
  opts: EnrichOptions = {},
): Promise<EnrichResult> {
  const dbPath = resolveDbPath(config, opts.dbPathOverride)
  const field = opts.field ?? 'all'

  let toEnrich = Object.entries(db).filter(([, ing]) => {
    const needsDensity = !ing.physical?.density
    const needsNutrition = !ing.nutrition
    if (field === 'density') return needsDensity
    if (field === 'nutrition') return needsNutrition
    return needsDensity || needsNutrition
  })

  if (opts.ingredient) {
    toEnrich = toEnrich.filter(([id]) => id === opts.ingredient)
  }

  const skipped = Object.keys(db).filter(id => !toEnrich.some(([tid]) => tid === id))

  if (toEnrich.length === 0) {
    return { dbPath, totalIncomplete: 0, enriched: [], skipped, failed: [] }
  }

  const BATCH_SIZE = 8
  const batches: Array<[string, IngredientData][]> = []
  for (let i = 0; i < toEnrich.length; i += BATCH_SIZE) {
    batches.push(toEnrich.slice(i, i + BATCH_SIZE))
  }

  const limit = pLimit(5)
  const enriched: EnrichEntry[] = []
  const failed: string[] = []
  let batchsDone = 0

  await Promise.all(
    batches.map(batch =>
      limit(async () => {
        const prompt = JSON.stringify(
          batch.map(([id, ing]) => ({ key: id, name: ing.name })),
        )

        const batchEnriched: string[] = []
        const batchFailed: string[] = []

        let parsed: z.infer<typeof EnrichResponseSchema>
        try {
          const { object } = await generateObject({
            model,
            system: SYSTEM_PROMPT,
            prompt,
            schema: EnrichResponseSchema,
          })
          parsed = object
        } catch {
          for (const [id] of batch) batchFailed.push(id)
          failed.push(...batchFailed)
          opts.onBatchDone?.(++batchsDone, batches.length, batchEnriched, batchFailed)
          return
        }

        for (const item of parsed.ingredients) {
          const [, ing] = batch.find(([id]) => id === item.key) ?? []
          if (!ing) {
            batchFailed.push(item.key)
            continue
          }
          const entry: EnrichEntry = {
            id: item.key,
            name: ing.name,
            density: item.density,
            unit_weight: item.unit_weight,
            nutrition: item.nutrition,
            tagSuggestions: Array.from(new Set([item.aisle, ...item.tagSuggestions].filter(Boolean))),
          }
          enriched.push(entry)
          batchEnriched.push(item.key)
        }

        for (const [id] of batch) {
          if (!parsed.ingredients.some(i => i.key === id) && !failed.includes(id)) {
            batchFailed.push(id)
          }
        }

        failed.push(...batchFailed)
        opts.onBatchDone?.(++batchsDone, batches.length, batchEnriched, batchFailed)
      }),
    ),
  )

  if (!opts.dryRun && enriched.length > 0) {
    await withFileLock(dbPath, async () => {
      const content = await readFile(dbPath, 'utf-8').catch(() => '')
      const doc = content ? parseDocument(content) : null

      if (doc) {
        const root = doc.toJSON() as Record<string, unknown>
        const hasWrapper = root && 'ingredients' in root
        const node = hasWrapper ? doc.get('ingredients') : doc.contents

        if (isMap(node)) {
          for (const entry of enriched) {
            const ingNode = node.get(entry.id, true) as any
            if (!isMap(ingNode)) continue

            if (entry.density != null || entry.unit_weight != null) {
              const physNode = ingNode.get('physical', true)
              if (!isMap(physNode)) {
                const data: any = {}
                if (entry.density != null) data.density = entry.density
                if (entry.unit_weight != null) data.unit_weight = entry.unit_weight
                ingNode.set('physical', doc.createNode(data))
              } else {
                if (entry.density != null) (physNode as any).set('density', entry.density)
                if (entry.unit_weight != null) (physNode as any).set('unit_weight', entry.unit_weight)
              }
            }

            if (entry.tagSuggestions && entry.tagSuggestions.length > 0) {
              const existingTags = ingNode.get('tags') as string[] | null | undefined
              if (!existingTags || existingTags.length === 0) {
                ingNode.set('tags', doc.createNode(entry.tagSuggestions))
              }
            }

            if (entry.nutrition != null) {
              ingNode.set('nutrition', doc.createNode(entry.nutrition))
            }
          }
          await mkdir(dirname(dbPath), { recursive: true })
          await atomicWrite(dbPath, String(doc))
        }
      }
    })
  }

  return { dbPath, totalIncomplete: toEnrich.length, enriched, skipped, failed }
}

import pLimit from 'p-limit'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { parseDocument, isMap } from 'yaml'
import { z } from 'zod'
import type { GoogleGenerativeAI } from '@google/generative-ai'
import { SchemaType } from '@google/generative-ai'
import type { IngredientData } from '@gram/analyzer'
import { DEFAULT_AI_MODEL } from '../core/ai'
import type { GramConfig, EnrichEntry, EnrichResult, EnrichOptions } from '../types'

const SYSTEM_PROMPT =
  'You are a culinary database assistant. For each ingredient provided, return accurate physical and nutritional data based on standard food science references. Use SI units: density in g/mL, nutrition per 100g of edible portion.'

const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    ingredients: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          key: { type: SchemaType.STRING },
          density: { type: SchemaType.NUMBER },
          nutrition: {
            type: SchemaType.OBJECT,
            properties: {
              calories: { type: SchemaType.NUMBER },
              carbs: { type: SchemaType.NUMBER },
              protein: { type: SchemaType.NUMBER },
              fat: { type: SchemaType.NUMBER },
            },
          },
          aliasSuggestions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          tagSuggestions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ['key'],
      },
    },
  },
  required: ['ingredients'],
}

const EnrichItemSchema = z.object({
  key: z.string(),
  density: z.number().max(5).optional(),
  nutrition: z
    .object({
      calories: z.number().max(1000),
      carbs: z.number().min(0),
      protein: z.number().min(0),
      fat: z.number().min(0),
    })
    .optional(),
  aliasSuggestions: z.array(z.string()).default([]),
  tagSuggestions: z.array(z.string()).default([]),
})

const EnrichResponseSchema = z.object({
  ingredients: z.array(EnrichItemSchema),
})

export async function enrichDb(
  db: Record<string, IngredientData>,
  config: GramConfig,
  ai: GoogleGenerativeAI,
  opts: EnrichOptions = {},
): Promise<EnrichResult> {
  const dbPath = resolve(opts.dbPathOverride ?? config.database ?? '.gram/ingredients.yaml')
  const field = opts.field ?? 'all'

  // Filter ingredients to enrich
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

  const model = ai.getGenerativeModel({
    model: config.ai?.model ?? DEFAULT_AI_MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA as any,
    },
  })

  const BATCH_SIZE = 8
  const batches: Array<[string, IngredientData][]> = []
  for (let i = 0; i < toEnrich.length; i += BATCH_SIZE) {
    batches.push(toEnrich.slice(i, i + BATCH_SIZE))
  }

  const limit = pLimit(5)
  const enriched: EnrichEntry[] = []
  const failed: string[] = []

  await Promise.all(
    batches.map((batch, batchIdx) =>
      limit(async () => {
        const prompt = JSON.stringify(
          batch.map(([id, ing]) => ({ key: id, name: ing.name, aliases: ing.aliases ?? [] })),
        )

        let parsed: z.infer<typeof EnrichResponseSchema>
        try {
          const res = await model.generateContent(prompt)
          const text = res.response.text()
          parsed = EnrichResponseSchema.parse(JSON.parse(text))
        } catch {
          for (const [id] of batch) failed.push(id)
          return
        }

        for (const item of parsed.ingredients) {
          const [, ing] = batch.find(([id]) => id === item.key) ?? []
          if (!ing) {
            failed.push(item.key)
            continue
          }
          enriched.push({
            id: item.key,
            name: ing.name,
            density: item.density,
            nutrition: item.nutrition,
            aliasSuggestions: item.aliasSuggestions,
            tagSuggestions: item.tagSuggestions,
          })
        }

        // If Gemini returned fewer items than sent, mark missing as failed
        for (const [id] of batch) {
          if (!parsed.ingredients.some(i => i.key === id) && !failed.includes(id)) {
            failed.push(id)
          }
        }
      }),
    ),
  )

  if (!opts.dryRun && enriched.length > 0) {
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

          if (entry.density != null) {
            const physNode = ingNode.get('physical', true)
            if (!isMap(physNode)) {
              ingNode.set('physical', doc.createNode({ density: entry.density }))
            } else {
              (physNode as any).set('density', entry.density)
            }
          }

          if (entry.nutrition != null) {
            const nutNode = doc.createNode(entry.nutrition)
            ingNode.set('nutrition', nutNode)
          }
        }
        await mkdir(dirname(dbPath), { recursive: true })
        await writeFile(dbPath, String(doc))
      }
    }
  }

  return {
    dbPath,
    totalIncomplete: toEnrich.length,
    enriched,
    skipped,
    failed,
  }
}

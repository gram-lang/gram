import pLimit from 'p-limit'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { parseDocument, YAMLMap, isMap, Document } from 'yaml'
import { runPipeline } from '../core/pipeline'
import type { GramConfig, DbSyncResult, DbSyncOptions } from '../types'
import { getIngredientData } from '@gram/analyzer'

export async function syncIngredients(
  files: string[],
  config: GramConfig,
  opts: DbSyncOptions = {},
): Promise<DbSyncResult> {
  const dbPath = resolve(opts.dbPathOverride ?? config.database ?? '.gram/ingredients.yaml')

  // Collect all ingredient IDs + display names referenced in recipes (no analyzer needed)
  const limit = pLimit(20)
  const itemBatches = await Promise.all(
    files.map(file =>
      limit(async () => {
        const { compiled } = await runPipeline(file, { skipAnalyzer: true })
        return (compiled.shopping_list as Array<{ id: string; name: string; type?: string }>)
          .filter(item => item.type !== 'alternative')
          .map(item => ({ id: item.id, name: item.name }))
      }),
    ),
  )

  // Deduplicate by id, keeping the first name seen
  const allItems = new Map<string, string>()
  for (const batch of itemBatches) {
    for (const { id, name } of batch) {
      if (!allItems.has(id)) allItems.set(id, name)
    }
  }

  // Load existing DB via AST to preserve comments
  let doc: Document | null = null
  let existingRaw: Record<string, unknown> = {}
  try {
    const content = await readFile(dbPath, 'utf-8')
    doc = parseDocument(content)
    const raw = doc.toJSON() as Record<string, unknown> | null
    if (raw && raw.ingredients && typeof raw.ingredients === 'object') {
      existingRaw = raw.ingredients as Record<string, unknown>
    } else if (raw && typeof raw === 'object' && !('ingredients' in raw)) {
      existingRaw = raw as Record<string, unknown>
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    // File doesn't exist yet
    doc = new Document({ ingredients: {} })
  }

  // Instead of just checking exact keys, we use the analyzer's resolution logic
  // which checks aliases and naive plurals (ends with 's')
  const existingIngredients: string[] = []
  const newIngredients: string[] = []

  for (const id of allItems.keys()) {
    if (getIngredientData(id, existingRaw as any)) {
      existingIngredients.push(id)
    } else {
      newIngredients.push(id)
    }
  }

  existingIngredients.sort()
  newIngredients.sort()

  if (!opts.dryRun && newIngredients.length > 0) {
    if (!doc) doc = new Document({ ingredients: {} })
    
    // Find or create the 'ingredients' map
    let ingredientsMap = doc.get('ingredients')
    if (!ingredientsMap || !isMap(ingredientsMap)) {
      ingredientsMap = doc.createNode({})
      if (isMap(ingredientsMap)) ingredientsMap.flow = false
      doc.set('ingredients', ingredientsMap)
    }

    if (isMap(ingredientsMap)) {
      ingredientsMap.flow = false
      
      for (const id of newIngredients) {
        const ingNode = doc.createNode({ name: allItems.get(id) ?? id, aliases: [], tags: [] })
        if (isMap(ingNode)) ingNode.flow = false
        
        ingredientsMap.add({
          key: doc.createNode(id),
          value: ingNode
        })
      }
      
      // Sort the AST items alphabetically to maintain order while preserving comments
      ingredientsMap.items.sort((a, b) => {
        const keyA = String(a.key)
        const keyB = String(b.key)
        return keyA.localeCompare(keyB)
      })

      // Add a blank line between each ingredient for better manual readability
      for (let i = 1; i < ingredientsMap.items.length; i++) {
        const item = ingredientsMap.items[i]
        if (item.key && typeof item.key === 'object') {
          (item.key as any).spaceBefore = true
        }
      }
    }

    await mkdir(dirname(dbPath), { recursive: true })
    await writeFile(dbPath, String(doc))
  }

  return {
    dbPath,
    totalFound: allItems.size,
    newIngredients,
    existingIngredients,
  }
}

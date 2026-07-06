import pLimit from 'p-limit'
import { readFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { parseDocument, isMap, Document } from 'yaml'
import { runPipeline } from '../core/pipeline'
import { getIngredientData, type IngredientData } from '@gram-lang/analyzer'
import { findSimilarInDb } from '../core/fuzzy'
import { withFileLock, atomicWrite } from '../core/lock'
import { resolveDbPath } from '../core/db'
import { addAliasesToNode } from '../core/db-writer'
import type { GramConfig, DbSyncResult, DbSyncOptions, DbSyncAnalysis, FuzzyMatch } from '../types'

export async function analyzeIngredients(
  files: string[],
  db: Record<string, IngredientData>,
  config: GramConfig,
  opts: DbSyncOptions = {},
): Promise<DbSyncAnalysis> {
  const dbPath = resolveDbPath(config, opts.dbPathOverride)

  const limit = pLimit(20)
  const itemBatches = await Promise.all(
    files.map(file =>
      limit(async () => {
        const { compiled } = await runPipeline(file, { skipAnalyzer: true })
        // Use registry (not shopping_list) so composite children like `egg-yolks`
        // from `@egg yolks{}<@eggs` are included — they only appear in usage[] sub-arrays
        // in the shopping list and are never exposed as top-level items there.
        const reg = compiled.registry.ingredients as Record<string, { id: string; name: string; is_intermediate?: boolean }>
        return Object.values(reg)
          .filter(entry => !entry.is_intermediate)
          .map(entry => ({ id: entry.id, name: entry.name }))
      }),
    ),
  )

  const allIds = new Map<string, string>()
  for (const batch of itemBatches) {
    for (const { id, name } of batch) {
      if (!allIds.has(id)) allIds.set(id, name)
    }
  }

  const exactMatches: string[] = []
  const fuzzyMatches: FuzzyMatch[] = []
  const genuinelyNew: string[] = []

  for (const id of allIds.keys()) {
    if (getIngredientData(id, db)) {
      exactMatches.push(id)
    } else {
      const match = findSimilarInDb(id, db)
      if (match) {
        fuzzyMatches.push(match)
      } else {
        genuinelyNew.push(id)
      }
    }
  }

  exactMatches.sort()
  fuzzyMatches.sort((a, b) => a.newId.localeCompare(b.newId))
  genuinelyNew.sort()

  return { dbPath, allIds, exactMatches, fuzzyMatches, genuinelyNew }
}

// decisions: Map<newId, 'new' | `alias-of:${existingId}` | 'ignore'>
export async function applySync(
  analysis: DbSyncAnalysis,
  decisions: Map<string, string>,
  opts: DbSyncOptions = {},
): Promise<DbSyncResult> {
  const { dbPath, allIds, exactMatches } = analysis

  const toCreate: string[] = []
  const toAlias: Array<{ newId: string; existingId: string }> = []

  for (const [newId, decision] of decisions) {
    if (decision === 'new') {
      toCreate.push(newId)
    } else if (decision.startsWith('alias-of:')) {
      toAlias.push({ newId, existingId: decision.slice('alias-of:'.length) })
    }
    // 'ignore' → nothing
  }

  const aliasedIngredients = toAlias.map(a => a.newId)

  if (opts.dryRun || (toCreate.length === 0 && toAlias.length === 0)) {
    return {
      dbPath,
      totalFound: allIds.size,
      newIngredients: toCreate,
      aliasedIngredients,
      existingIngredients: exactMatches,
    }
  }

  await withFileLock(dbPath, async () => {
    let doc: Document
    try {
      const content = await readFile(dbPath, 'utf-8')
      doc = parseDocument(content)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
      doc = new Document({ ingredients: {} })
    }

    let ingredientsMap = doc.get('ingredients', true)
    if (!ingredientsMap || !isMap(ingredientsMap)) {
      const node = doc.createNode({})
      if (isMap(node)) node.flow = false
      doc.set('ingredients', node)
      ingredientsMap = doc.get('ingredients', true)
    }

    if (!isMap(ingredientsMap)) {
      throw new Error('Could not locate or create ingredients map in YAML document')
    }

    ingredientsMap.flow = false

    for (const { newId, existingId } of toAlias) {
      const ingNode = ingredientsMap.get(existingId, true)
      if (!isMap(ingNode)) continue
      addAliasesToNode(doc, ingNode, [newId])
    }

    for (const id of toCreate) {
      const ingNode = doc.createNode({ name: allIds.get(id) ?? id, aliases: [], tags: [] })
      if (isMap(ingNode)) ingNode.flow = false
      ingredientsMap.add({ key: doc.createNode(id), value: ingNode })
    }

    ingredientsMap.items.sort((a, b) => String(a.key).localeCompare(String(b.key)))
    for (let i = 1; i < ingredientsMap.items.length; i++) {
      const item = ingredientsMap.items[i]
      if (item?.key && typeof item.key === 'object') {
        (item.key as any).spaceBefore = true
      }
    }

    await mkdir(dirname(dbPath), { recursive: true })
    await atomicWrite(dbPath, String(doc))
  })

  return {
    dbPath,
    totalFound: allIds.size,
    newIngredients: toCreate,
    aliasedIngredients,
    existingIngredients: exactMatches,
  }
}

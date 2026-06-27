import pLimit from 'p-limit'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, dirname, join } from 'node:path'
import { parseDocument, isMap, isSeq, Document, Scalar } from 'yaml'
import { runPipeline } from '../core/pipeline'
import { getIngredientData, type IngredientData } from '@gram/analyzer'
import { findSimilarInDb } from '../core/fuzzy'
import { withFileLock, atomicWrite } from '../core/lock'
import type { GramConfig, DbSyncResult, DbSyncOptions, DbSyncAnalysis, FuzzyMatch } from '../types'

function resolveDbPath(config: GramConfig, override?: string): string {
  const root = config.projectRoot ?? process.cwd()
  if (override) return resolve(override)
  if (config.database) return resolve(root, config.database)
  return join(root, '.gram', 'ingredients.yaml')
}

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
        return (compiled.shopping_list as Array<{ id: string; name: string; type?: string }>)
          .filter(item => item.type !== 'alternative')
          .map(item => ({ id: item.id, name: item.name }))
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
      const aliasesNode = ingNode.get('aliases', true)
      const quotedId = doc.createNode(newId)
      ;(quotedId as Scalar).type = Scalar.QUOTE_DOUBLE
      if (isSeq(aliasesNode)) {
        aliasesNode.add(quotedId)
      } else {
        const seq = doc.createNode([] as string[])
        ;(seq as any).add(quotedId)
        ingNode.set('aliases', seq)
      }
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

import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseDocument, isMap, isSeq, Scalar } from 'yaml'
import { z } from 'zod'
import { generateObject } from 'ai'
import type { LanguageModel } from 'ai'
import type { IngredientData } from '@gram/analyzer'
import { getAiLanguageInstruction } from '@gram/i18n'
import type { GramConfig, LintResult, LintIssue, LintOptions } from '../types'

function buildSystemPrompt(lang: string): string {
  return `${getAiLanguageInstruction(lang)} You are a culinary database assistant. Analyze ingredient database keys and identify linguistic or semantic issues. Be conservative: only report high-confidence issues.`
}

const LintIssueRawSchema = z.object({
  type: z.enum(['plural', 'duplicate']),
  ids: z.array(z.string()).min(2),
  keepId: z.string(),
  aliasIds: z.array(z.string()).min(1),
})

const LintResponseSchema = z.object({
  issues: z.array(LintIssueRawSchema),
})

export async function lintDb(
  db: Record<string, IngredientData>,
  config: GramConfig,
  model: LanguageModel,
  opts: LintOptions = {},
): Promise<LintResult> {
  const dbPath = resolve(opts.dbPathOverride ?? config.database ?? '.gram/ingredients.yaml')

  const keys = Object.entries(db).map(([id, ing]) => ({ key: id, name: ing.name }))

  const prompt = `Analyze these ingredient database keys and find:
1. Keys that are plurals of another key in the list (e.g. "oeufs" when "oeuf" exists). Propose the singular form as keepId.
2. Keys that are semantic duplicates (same ingredient, different wording). Propose the most canonical key as keepId.

Only report issues where all IDs actually appear in the provided list. Be conservative.

Ingredient list:
${JSON.stringify(keys, null, 2)}`

  const { object: raw } = await generateObject({
    model,
    system: buildSystemPrompt(config.language ?? 'en'),
    prompt,
    schema: LintResponseSchema,
  })

  const dbKeys = new Set(Object.keys(db))

  const issues: LintIssue[] = []
  for (const item of raw.issues) {
    if (!item.ids.every(id => dbKeys.has(id))) continue
    if (!dbKeys.has(item.keepId)) continue
    if (!item.aliasIds.every(id => dbKeys.has(id))) continue

    const hasNutritionConflict =
      item.type === 'duplicate' &&
      item.ids.filter(id => db[id]?.nutrition != null).length > 1

    issues.push({
      type: item.type,
      ids: item.ids,
      suggestion: { keepId: item.keepId, aliasIds: item.aliasIds },
      hasNutritionConflict,
    })
  }

  return { dbPath, issues }
}

export interface LintDecision {
  issueIndex: number
  action: 'apply' | 'skip'
  keepId?: string
  keepNutrition?: 'keep' | 'source'
}

export async function applyLintDecisions(
  result: LintResult,
  decisions: LintDecision[],
): Promise<{ applied: number; skipped: number }> {
  const content = await readFile(result.dbPath, 'utf-8')
  const doc = parseDocument(content)

  let ingredientsMap = doc.get('ingredients', true)
  if (!isMap(ingredientsMap)) {
    ingredientsMap = doc.contents
  }
  if (!isMap(ingredientsMap)) throw new Error('Cannot locate ingredients map in YAML document')

  let applied = 0
  let skipped = 0

  for (const decision of decisions) {
    const issue = result.issues[decision.issueIndex]
    if (!issue || decision.action === 'skip') {
      skipped++
      continue
    }

    const { keepId, aliasIds } = issue.suggestion

    if (issue.type === 'plural') {
      const keepNode = ingredientsMap.get(keepId, true)
      if (!isMap(keepNode)) { skipped++; continue }

      for (const aliasId of aliasIds) {
        if (aliasId === keepId) continue

        const aliasNode = ingredientsMap.get(aliasId, true)
        if (isMap(aliasNode)) {
          const aliasesRaw = aliasNode.get('aliases', true)
          const oldAliases: string[] = isSeq(aliasesRaw) ? aliasesRaw.toJSON() : []
          _addAliasesToNode(doc, keepNode, [aliasId, ...oldAliases])
          _deleteKey(ingredientsMap, aliasId)
        } else {
          _addAliasesToNode(doc, keepNode, [aliasId])
        }
      }
    } else {
      const effectiveKeepId = decision.keepId ?? keepId
      const effectiveAliasIds = issue.ids.filter(id => id !== effectiveKeepId)

      const keepNode = ingredientsMap.get(effectiveKeepId, true)
      if (!isMap(keepNode)) { skipped++; continue }

      for (const aliasId of effectiveAliasIds) {
        const sourceNode = ingredientsMap.get(aliasId, true)
        if (!isMap(sourceNode)) continue

        if (decision.keepNutrition === 'source') {
          const sourceNutrition = sourceNode.get('nutrition', true)
          if (sourceNutrition) keepNode.set('nutrition', sourceNutrition)
        }

        const keepPhys = keepNode.get('physical')
        const sourcePhys = sourceNode.get('physical', true)
        if (!keepPhys && sourcePhys) keepNode.set('physical', sourcePhys)

        const aliasesRaw = sourceNode.get('aliases', true)
        const oldAliases: string[] = isSeq(aliasesRaw) ? aliasesRaw.toJSON() : []
        _addAliasesToNode(doc, keepNode, [aliasId, ...oldAliases])

        _deleteKey(ingredientsMap, aliasId)
      }
    }

    applied++
  }

  ingredientsMap.items.sort((a, b) => String(a.key).localeCompare(String(b.key)))
  for (let i = 1; i < ingredientsMap.items.length; i++) {
    const item = ingredientsMap.items[i]
    if (item?.key && typeof item.key === 'object') {
      (item.key as any).spaceBefore = true
    }
  }

  await writeFile(result.dbPath, String(doc))
  return { applied, skipped }
}

function _quotedNode(doc: ReturnType<typeof parseDocument>, value: string) {
  const n = doc.createNode(value)
  ;(n as Scalar).type = Scalar.QUOTE_DOUBLE
  return n
}

function _addAliasesToNode(doc: ReturnType<typeof parseDocument>, node: any, newAliases: string[]): void {
  const aliasesNode = node.get('aliases', true)
  const existing: string[] = isSeq(aliasesNode) ? aliasesNode.toJSON() : []
  const merged = Array.from(new Set([...existing, ...newAliases]))
  if (isSeq(aliasesNode)) {
    aliasesNode.items.length = 0
    for (const a of merged) aliasesNode.add(_quotedNode(doc, a))
  } else {
    const seq = doc.createNode([] as string[])
    for (const a of merged) ;(seq as any).add(_quotedNode(doc, a))
    node.set('aliases', seq)
  }
}

function _deleteKey(map: any, key: string): void {
  const idx = map.items.findIndex((pair: any) => String(pair.key) === key)
  if (idx !== -1) map.items.splice(idx, 1)
}

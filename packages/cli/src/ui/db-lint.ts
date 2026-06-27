import chalk from 'chalk'
import { log, select, note } from '@clack/prompts'
import type { IngredientData } from '@gram/analyzer'
import type { LintResult, LintIssue } from '../types'
import type { LintDecision } from '../types'

type NutritionKey = 'calories' | 'fat' | 'carbs' | 'protein' | 'sugar' | 'sat_fat' | 'fiber' | 'sodium'

const NUTRITION_FIELDS: NutritionKey[] = [
  'calories', 'fat', 'carbs', 'protein', 'sugar', 'sat_fat', 'fiber', 'sodium',
]
const NUTRITION_LABELS: Record<NutritionKey, string> = {
  calories: 'kcal', fat: 'fat', carbs: 'carbs', protein: 'prot',
  sugar: 'sugar', sat_fat: 'sat', fiber: 'fiber', sodium: 'sod',
}
const NUTRITION_UNITS: Record<NutritionKey, string> = {
  calories: '', fat: 'g', carbs: 'g', protein: 'g',
  sugar: 'g', sat_fat: 'g', fiber: 'g', sodium: 'g',
}

function diffNutritionFields(
  a: IngredientData['nutrition'],
  b: IngredientData['nutrition'],
): NutritionKey[] {
  return NUTRITION_FIELDS.filter(f => (a?.[f] ?? undefined) !== (b?.[f] ?? undefined))
}

function formatNutritionRow(id: string, nutr: IngredientData['nutrition'], fields: NutritionKey[], padWidth: number): string {
  const parts = fields.map(f => {
    const val = nutr?.[f]
    return `${NUTRITION_LABELS[f]} ${val != null ? `${val}${NUTRITION_UNITS[f]}` : '–'}`
  })
  return `  ${id.padEnd(padWidth)}  ${parts.join('  ')}`
}

export function renderLintReport(result: LintResult): void {
  if (result.issues.length === 0) {
    log.success('Database looks clean — no duplicates or malformed plurals found.')
    return
  }

  const plurals = result.issues.filter(i => i.type === 'plural')
  const duplicates = result.issues.filter(i => i.type === 'duplicate')

  console.log()
  if (plurals.length > 0) {
    console.log(chalk.bold('  Plurals detected'))
    for (const issue of plurals) {
      console.log(
        `  ${chalk.yellow('→')} ${issue.suggestion.aliasIds.join(', ')} ${chalk.dim('→')} ${chalk.cyan(issue.suggestion.keepId)}`,
      )
    }
    console.log()
  }

  if (duplicates.length > 0) {
    console.log(chalk.bold('  Semantic duplicates'))
    for (const issue of duplicates) {
      const conflict = issue.hasNutritionConflict ? chalk.red(' (nutrition conflict)') : ''
      console.log(
        `  ${chalk.yellow('→')} ${issue.ids.join(', ')} ${chalk.dim('→')} keep ${chalk.cyan(issue.suggestion.keepId)}${conflict}`,
      )
    }
    console.log()
  }

  log.warn(
    `${result.issues.length} issue${result.issues.length !== 1 ? 's' : ''} detected. ` +
      `Run without --report to fix them.`,
  )
}

export async function promptLintDecisions(
  result: LintResult,
  db: Record<string, IngredientData>,
): Promise<LintDecision[]> {
  const decisions: LintDecision[] = []
  for (let i = 0; i < result.issues.length; i++) {
    const issue = result.issues[i]!
    const decision = await promptIssue(i, issue, db)
    decisions.push(decision)
  }
  return decisions
}

async function promptIssue(
  index: number,
  issue: LintIssue,
  db: Record<string, IngredientData>,
): Promise<LintDecision> {
  const { keepId } = issue.suggestion

  if (issue.type === 'plural') {
    const answer = await select({
      message: `Plural: "${issue.suggestion.aliasIds.join('", "')}" → merge into "${keepId}"?`,
      options: [
        {
          value: 'apply',
          label: `Merge — add ${issue.suggestion.aliasIds.map(a => `"${a}"`).join(', ')} as alias of "${keepId}"`,
          hint: 'backward compatible, no breaking changes',
        },
        { value: 'skip', label: 'Skip' },
      ],
    })
    return {
      issueIndex: index,
      action: typeof answer === 'symbol' || answer === 'skip' ? 'skip' : 'apply',
    }
  }

  // duplicate — let user choose which key to keep
  const keepAnswer = await select({
    message: `Duplicate: "${issue.ids.join('" and "')}" — which key should be the primary?`,
    options: [
      ...issue.ids.map(id => ({
        value: id,
        label: id === keepId ? `${id}  ${chalk.dim('(AI suggestion)')}` : id,
        hint: `"${issue.ids.find(other => other !== id)!}" will become an alias`,
      })),
      { value: 'skip', label: 'Skip' },
    ],
  })

  if (typeof keepAnswer === 'symbol' || keepAnswer === 'skip') {
    return { issueIndex: index, action: 'skip' }
  }

  const chosenKeepId = keepAnswer as string
  const aliasId = issue.ids.find(id => id !== chosenKeepId)!

  if (!issue.hasNutritionConflict) {
    return { issueIndex: index, action: 'apply', keepId: chosenKeepId }
  }

  const diffFields = diffNutritionFields(db[chosenKeepId]?.nutrition, db[aliasId]?.nutrition)

  if (diffFields.length === 0) {
    return { issueIndex: index, action: 'apply', keepId: chosenKeepId }
  }

  const padWidth = Math.max(chosenKeepId.length, aliasId.length)
  note(
    formatNutritionRow(chosenKeepId, db[chosenKeepId]?.nutrition, diffFields, padWidth) + '\n' +
    formatNutritionRow(aliasId, db[aliasId]?.nutrition, diffFields, padWidth),
    'Nutrition diff (per 100g)',
  )

  const nutrition = await select({
    message: `Which values to keep?`,
    options: [
      { value: 'keep', label: `From "${chosenKeepId}"` },
      { value: 'source', label: `From "${aliasId}"` },
    ],
  })

  return {
    issueIndex: index,
    action: 'apply',
    keepId: chosenKeepId,
    keepNutrition: typeof nutrition === 'symbol' ? 'keep' : (nutrition as 'keep' | 'source'),
  }
}

export function renderLintSummary(
  result: { applied: number; skipped: number },
  dbPath: string,
): void {
  const { applied, skipped } = result
  if (applied === 0) {
    log.info('No fixes applied.')
    return
  }
  log.success(
    `${applied} fix${applied !== 1 ? 'es' : ''} applied` +
      (skipped > 0 ? `, ${skipped} skipped` : '') +
      ` — ${dbPath}`,
  )
}

import chalk from 'chalk'
import { log, select, note } from '@clack/prompts'
import type { LintResult, LintIssue } from '../types'
import type { LintDecision } from '../services/db-linter'

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

export async function promptLintDecisions(result: LintResult): Promise<LintDecision[]> {
  const decisions: LintDecision[] = []

  for (let i = 0; i < result.issues.length; i++) {
    const issue = result.issues[i]!
    const decision = await promptIssue(i, issue)
    decisions.push(decision)
  }

  return decisions
}

async function promptIssue(index: number, issue: LintIssue): Promise<LintDecision> {
  const { keepId, aliasIds } = issue.suggestion

  if (issue.type === 'plural') {
    const answer = await select({
      message: `Plural: "${aliasIds.join('", "')}" → merge into "${keepId}"?`,
      options: [
        {
          value: 'apply',
          label: `Merge — add ${aliasIds.map(a => `"${a}"`).join(', ')} as alias of "${keepId}"`,
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

  // duplicate — let the user choose which key to keep
  const keepAnswer = await select({
    message: `Duplicate: "${issue.ids.join('" and "')}" — which key should be the primary?`,
    options: [
      ...issue.ids.map(id => ({
        value: id,
        label: id === keepId
          ? `${id}  ${chalk.dim('(AI suggestion)')}`
          : id,
        hint: id === keepId ? undefined : `"${keepId}" will become an alias`,
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

  const nutrition = await select({
    message: `Both have nutrition data — which values to keep?`,
    options: [
      { value: 'keep', label: `From "${chosenKeepId}" (primary)` },
      { value: 'source', label: `From "${aliasId}" (will become alias)` },
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

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
    console.log(chalk.bold('  Pluriels détectés'))
    for (const issue of plurals) {
      console.log(
        `  ${chalk.yellow('→')} ${issue.suggestion.aliasIds.join(', ')} ${chalk.dim('→')} ${chalk.cyan(issue.suggestion.keepId)}`,
      )
    }
    console.log()
  }

  if (duplicates.length > 0) {
    console.log(chalk.bold('  Doublons sémantiques'))
    for (const issue of duplicates) {
      const conflict = issue.hasNutritionConflict ? chalk.red(' (conflit nutrition)') : ''
      console.log(
        `  ${chalk.yellow('→')} ${issue.ids.join(', ')} ${chalk.dim('→')} conserver ${chalk.cyan(issue.suggestion.keepId)}${conflict}`,
      )
    }
    console.log()
  }

  log.warn(
    `${result.issues.length} problème${result.issues.length !== 1 ? 's' : ''} détecté${result.issues.length !== 1 ? 's' : ''}. ` +
      `Relancez sans --report pour les corriger.`,
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
      message: `Pluriel : "${aliasIds.join('", "')}" → fusionner dans "${keepId}" ?`,
      options: [
        {
          value: 'apply',
          label: `Fusionner — ajouter ${aliasIds.map(a => `"${a}"`).join(', ')} comme alias de "${keepId}"`,
          hint: 'rétrocompatible, zéro rupture',
        },
        { value: 'skip', label: 'Ignorer' },
      ],
    })
    return {
      issueIndex: index,
      action: typeof answer === 'symbol' || answer === 'skip' ? 'skip' : 'apply',
    }
  }

  // duplicate
  const answer = await select({
    message: `Doublon : "${issue.ids.join('", "')}" — conserver "${keepId}" et supprimer les autres ?`,
    options: [
      {
        value: 'apply',
        label: `Fusionner dans "${keepId}"`,
        hint: issue.hasNutritionConflict ? 'nutrition à choisir à l\'étape suivante' : undefined,
      },
      { value: 'skip', label: 'Ignorer' },
    ],
  })

  if (typeof answer === 'symbol' || answer === 'skip') {
    return { issueIndex: index, action: 'skip' }
  }

  if (!issue.hasNutritionConflict) {
    return { issueIndex: index, action: 'apply' }
  }

  const nutrition = await select({
    message: `Conflit nutrition entre "${keepId}" et "${aliasIds[0]}" — quelle valeur conserver ?`,
    options: [
      { value: 'keep', label: `Garder la nutrition de "${keepId}"` },
      { value: 'source', label: `Utiliser la nutrition de "${aliasIds[0]}"` },
    ],
  })

  return {
    issueIndex: index,
    action: 'apply',
    keepNutrition: typeof nutrition === 'symbol' ? 'keep' : (nutrition as 'keep' | 'source'),
  }
}

export function renderLintSummary(
  result: { applied: number; skipped: number },
  dbPath: string,
): void {
  const { applied, skipped } = result
  if (applied === 0) {
    log.info('Aucune correction appliquée.')
    return
  }
  log.success(
    `${applied} correction${applied !== 1 ? 's' : ''} appliquée${applied !== 1 ? 's' : ''}` +
      (skipped > 0 ? `, ${skipped} ignorée${skipped !== 1 ? 's' : ''}` : '') +
      ` — ${dbPath}`,
  )
}

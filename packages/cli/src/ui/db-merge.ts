import chalk from 'chalk'
import { log, select, isCancel } from '@clack/prompts'
import { relative } from 'node:path'
import type { MergeAnalysis, MergeConflict, PreferSide } from '../services/db-merger'

export function renderMergePreview(analysis: MergeAnalysis): void {
  const { toAdd, toEnrich, conflicts, unchanged } = analysis
  const total = toAdd.length + toEnrich.length + conflicts.length
  console.log()

  if (total === 0 && unchanged.length > 0) {
    log.success(`Database already up to date — ${unchanged.length} entries identical.`)
    return
  }

  const parts: string[] = []
  if (unchanged.length > 0) parts.push(chalk.dim(`${unchanged.length} unchanged`))
  if (toAdd.length > 0) parts.push(chalk.green(`${toAdd.length} new`))
  if (toEnrich.length > 0) parts.push(chalk.blue(`${toEnrich.length} enriched`))
  if (conflicts.length > 0) parts.push(chalk.yellow(`${conflicts.length} conflict${conflicts.length !== 1 ? 's' : ''}`))
  console.log(`  ${parts.join(chalk.dim(' · '))}`)
  console.log()

  for (const { key } of toAdd) {
    console.log(`  ${chalk.green('+')} ${key}`)
  }

  for (const { localKey, additions, aliasAdditions, tagAdditions } of toEnrich) {
    const fields: string[] = []
    if (Object.keys(additions).length > 0) fields.push(...Object.keys(additions))
    if (aliasAdditions.length > 0) fields.push(`+${aliasAdditions.length} alias${aliasAdditions.length !== 1 ? 'es' : ''}`)
    if (tagAdditions.length > 0) fields.push(`+${tagAdditions.length} tag${tagAdditions.length !== 1 ? 's' : ''}`)
    console.log(`  ${chalk.blue('~')} ${localKey}  ${chalk.dim(fields.join(', '))}`)
  }

  for (const { localKey, field } of conflicts) {
    console.log(`  ${chalk.yellow('!')} ${localKey}  ${chalk.dim(`conflict: ${field}`)}`)
  }

  console.log()
}

function renderConflictValue(val: unknown): string {
  if (typeof val === 'object' && val !== null) {
    return Object.entries(val as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')
  }
  return String(val)
}

export async function resolveConflictsInteractively(
  conflicts: MergeConflict[],
  globalPrefer: PreferSide | undefined,
): Promise<Map<string, PreferSide> | null> {
  const resolved = new Map<string, PreferSide>()

  if (globalPrefer) {
    for (const { localKey, field } of conflicts) {
      resolved.set(`${localKey}:${field}`, globalPrefer)
    }
    return resolved
  }

  for (const conflict of conflicts) {
    console.log()
    console.log(`  ${chalk.yellow('!')} ${chalk.bold(conflict.localKey)} — ${chalk.dim(conflict.field)}`)
    console.log(`    ${chalk.dim('local:')}   ${renderConflictValue(conflict.localValue)}`)
    console.log(`    ${chalk.dim('remote:')}  ${renderConflictValue(conflict.remoteValue)}`)

    const choice = await select({
      message: `Keep which value for ${conflict.field}?`,
      options: [
        { value: 'local', label: 'Keep local' },
        { value: 'remote', label: 'Use remote' },
      ],
    })

    if (isCancel(choice)) {
      log.warn('Merge cancelled.')
      return null
    }

    resolved.set(`${conflict.localKey}:${conflict.field}`, choice as PreferSide)
  }

  return resolved
}

export function renderMergeResult(
  analysis: MergeAnalysis,
  dryRun: boolean,
  skippedConflicts: number,
): void {
  const { dbPath, toAdd, toEnrich, conflicts } = analysis
  const relPath = relative(process.cwd(), dbPath) || dbPath
  const applied = toAdd.length + toEnrich.length + conflicts.length - skippedConflicts

  console.log()
  if (dryRun) {
    log.warn('Dry run — no changes written.')
  } else if (applied > 0) {
    log.success(`Updated ${chalk.dim(relPath)}`)
  } else {
    log.success('Nothing to merge.')
  }

  if (skippedConflicts > 0) {
    log.warn(`${skippedConflicts} conflict${skippedConflicts !== 1 ? 's' : ''} kept as local.`)
  }
  console.log()
}

import chalk from 'chalk'
import { log } from '@clack/prompts'
import { relative } from 'node:path'
import type { DbSyncResult } from '../types'

export function renderSyncResult(result: DbSyncResult, dryRun: boolean): void {
  const { newIngredients, aliasedIngredients, existingIngredients, dbPath } = result
  const relPath = relative(process.cwd(), dbPath) || dbPath

  const totalChanges = newIngredients.length + aliasedIngredients.length

  if (totalChanges === 0) {
    const n = existingIngredients.length
    log.success(`Database up to date — ${n} ingredient${n !== 1 ? 's' : ''}, nothing to add.`)
    return
  }

  console.log()
  const parts = [chalk.dim(`${existingIngredients.length} already in database`)]
  if (newIngredients.length > 0) parts.push(chalk.green(`${newIngredients.length} new`))
  if (aliasedIngredients.length > 0) parts.push(chalk.blue(`${aliasedIngredients.length} aliased`))
  console.log(`  ${parts.join(' · ')}`)
  console.log()

  for (const id of newIngredients) {
    console.log(`  ${chalk.green('+')} ${id}`)
  }
  for (const id of aliasedIngredients) {
    console.log(`  ${chalk.blue('~')} ${id}  ${chalk.dim('(alias)')}`)
  }
  console.log()

  if (dryRun) {
    log.warn(`Dry run — no changes written.`)
  } else {
    log.success(`Updated ${chalk.dim(relPath)}`)
    console.log(chalk.dim(`  → Run 'gram db lint' to merge any duplicates, then 'gram db enrich' to fill in missing data.`))
  }
}

import chalk from 'chalk'
import { log } from '@clack/prompts'
import { relative } from 'node:path'
import type { DbSyncResult } from '../types'

export function renderSyncResult(result: DbSyncResult, dryRun: boolean): void {
  const { newIngredients, existingIngredients, dbPath } = result
  const relPath = relative(process.cwd(), dbPath) || dbPath

  if (newIngredients.length === 0) {
    const n = existingIngredients.length
    log.success(`Database up to date — ${n} ingredient${n !== 1 ? 's' : ''}, nothing to add.`)
    return
  }

  console.log()
  console.log(
    `  ${chalk.dim(existingIngredients.length + ' already in database')} · ${chalk.green(newIngredients.length + ' new')}`,
  )
  console.log()
  for (const id of newIngredients) {
    console.log(`  ${chalk.green('+')} ${id}`)
  }
  console.log()

  if (dryRun) {
    log.warn(`Dry run — no changes written.`)
  } else {
    log.success(`Updated ${chalk.dim(relPath)}`)
    console.log(chalk.dim(`  → Run 'gram db enrich' to fill in density and nutrition data.`))
  }
}

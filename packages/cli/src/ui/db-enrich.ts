import chalk from 'chalk'
import { log } from '@clack/prompts'
import { relative } from 'node:path'
import type { EnrichResult } from '../types'

export function renderEnrichResult(result: EnrichResult, dryRun: boolean): void {
  const { enriched, failed, totalIncomplete, dbPath } = result
  const relPath = relative(process.cwd(), dbPath) || dbPath

  if (totalIncomplete === 0) {
    log.success('All ingredients already complete — nothing to enrich.')
    return
  }

  console.log()
  for (const entry of enriched) {
    const parts: string[] = []
    if (entry.category) parts.push(entry.category)
    if (entry.density != null) parts.push(`density: ${entry.density} g/mL`)
    if (entry.nutrition != null) parts.push(`${entry.nutrition.calories} kcal/100g`)
    console.log(`  ${chalk.green('✓')} ${entry.name.padEnd(22)} ${chalk.dim(parts.join(' · '))}`)
  }
  for (const id of failed) {
    console.log(`  ${chalk.red('✗')} ${id.padEnd(22)} ${chalk.dim('invalid response — skipped')}`)
  }
  console.log()

  if (dryRun) {
    log.warn('Dry run — no changes written.')
  } else {
    const n = enriched.length
    const f = failed.length
    log.success(
      `Updated ${chalk.dim(relPath)} (${n} ingredient${n !== 1 ? 's' : ''} enriched${f ? `, ${f} failed` : ''})`,
    )
    if (f > 0) {
      console.log(
        chalk.dim(`  → Review failed ingredients manually or re-run \`gram db enrich --ingredient <slug>\``),
      )
    }
  }
}

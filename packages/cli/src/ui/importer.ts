import chalk from 'chalk'
import { log } from '@clack/prompts'
import { relative } from 'node:path'
import type { ImportResult } from '../types'

export function renderImportResult(result: ImportResult, source: string, outputPath?: string): void {
  const sourceLabel = source.startsWith('http') ? source : relative(process.cwd(), source) || source

  console.log()
  console.log(`  ${'Title'.padEnd(14)} ${result.title}`)
  console.log(`  ${'Ingredients'.padEnd(14)} ${result.ingredientCount}${result.parseWarnings.length ? chalk.yellow(` (${result.parseWarnings.length} unparsable)`) : ''}`)
  console.log(`  ${'Steps'.padEnd(14)} ${result.stepCount}`)

  if (result.parseWarnings.length > 0) {
    console.log()
    console.log(chalk.yellow('  ⚠ Could not parse:'))
    for (const w of result.parseWarnings) {
      console.log(`    ${chalk.dim(w)}`)
    }
  }

  console.log()

  if (outputPath) {
    log.success(`Written to ${chalk.dim(relative(process.cwd(), outputPath) || outputPath)}`)
    console.log(chalk.dim(`  → Run \`gram check ${relative(process.cwd(), outputPath)}\` to validate, then edit quantities manually.`))
  } else {
    log.info(`Imported from ${chalk.dim(sourceLabel)} — output on stdout`)
  }
}

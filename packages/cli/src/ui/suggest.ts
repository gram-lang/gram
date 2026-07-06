import chalk from 'chalk'
import { log } from '@clack/prompts'
import { relative } from 'node:path'
import type { RecipeSuggestion } from '../services/suggester'

export function renderSuggestions(
  results: RecipeSuggestion[],
  withTerms: string[],
  _withoutTerms: string[],
): void {
  if (results.length === 0) {
    log.warn('No matching recipes found.')
    return
  }

  console.log()
  for (const r of results) {
    const rel = relative(process.cwd(), r.file) || r.file
    const label = r.title ? `${chalk.bold(r.title)} ${chalk.dim(rel)}` : chalk.bold(rel)

    const bar = withTerms.length > 0
      ? ` ${chalk.green(`${r.score}%`)}`
      : ''

    console.log(`  ${label}${bar}`)

    if (r.matched.length > 0) {
      console.log(`    ${chalk.dim('✓')} ${r.matched.map(t => chalk.green(t)).join(chalk.dim(', '))}`)
    }
    if (r.missing.length > 0) {
      console.log(`    ${chalk.dim('✗')} ${r.missing.map(t => chalk.dim(t)).join(chalk.dim(', '))}`)
    }
    console.log()
  }
}

export function renderSuggestionsJson(results: RecipeSuggestion[]): void {
  console.log(JSON.stringify(results, null, 2))
}

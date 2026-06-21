import chalk from 'chalk'
import { log } from '@clack/prompts'
import { relative } from 'node:path'
import type { DbValidateResult } from '../types'

export function renderValidateResult(result: DbValidateResult): void {
  const { issues, dbPath, ingredientCount } = result
  const relPath = relative(process.cwd(), dbPath) || dbPath

  console.log()
  console.log(
    `${chalk.dim(relPath)} — ${ingredientCount} ingredient${ingredientCount !== 1 ? 's' : ''}`,
  )

  if (issues.length === 0) {
    console.log()
    log.success('Database valid — no issues found.')
    return
  }

  const byCategory = new Map<string, typeof issues>()
  for (const issue of issues) {
    const bucket = byCategory.get(issue.category) ?? []
    bucket.push(issue)
    byCategory.set(issue.category, bucket)
  }

  console.log()
  for (const [category, catIssues] of byCategory) {
    console.log(chalk.dim(`  [${category}]`))
    for (const issue of catIssues) {
      const icon = issue.level === 'error' ? chalk.red('✗') : chalk.yellow('⚠')
      const ing = issue.ingredient
        ? chalk.bold(issue.ingredient.padEnd(20))
        : ' '.repeat(20)
      console.log(`  ${icon} ${ing}  ${issue.message}`)
    }
    console.log()
  }

  const errCount = issues.filter(i => i.level === 'error').length
  const warnCount = issues.filter(i => i.level === 'warning').length
  const parts: string[] = []
  if (errCount) parts.push(chalk.red(`${errCount} error${errCount !== 1 ? 's' : ''}`))
  if (warnCount) parts.push(chalk.yellow(`${warnCount} warning${warnCount !== 1 ? 's' : ''}`))

  if (result.hasErrors) {
    log.error(parts.join(', '))
  } else {
    log.warn(parts.join(', '))
    if (warnCount > 0) {
      console.log(chalk.dim(`  → Run 'gram db enrich' to fill in missing data automatically.`))
    }
  }
}

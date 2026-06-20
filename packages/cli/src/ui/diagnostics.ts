import chalk from 'chalk'
import { log } from '@clack/prompts'
import { relative } from 'node:path'
import type { CheckResult, Diagnostic } from '../types'

function groupByFile(diagnostics: Diagnostic[]): Map<string, Diagnostic[]> {
  const map = new Map<string, Diagnostic[]>()
  for (const d of diagnostics) {
    const bucket = map.get(d.file) ?? []
    bucket.push(d)
    map.set(d.file, bucket)
  }
  return map
}

function displayPath(file: string): string {
  return relative(process.cwd(), file) || file
}

export function renderCheckResult(result: CheckResult): void {
  if (result.diagnostics.length === 0) {
    const n = result.fileCount
    log.success(`${n} file${n !== 1 ? 's' : ''} valid.`)
    return
  }

  for (const [file, diags] of groupByFile(result.diagnostics)) {
    console.log()
    console.log(chalk.bold(displayPath(file)))
    for (const d of diags) {
      const loc = d.line != null ? chalk.dim(`  line ${d.line}  `) : '  '
      const icon =
        d.level === 'error'
          ? chalk.red('✗')
          : d.level === 'warning'
            ? chalk.yellow('⚠')
            : chalk.blue('·')
      console.log(`${loc}${icon} ${d.message}`)
    }
  }

  const errCount = result.diagnostics.filter(d => d.level === 'error').length
  const warnCount = result.diagnostics.filter(d => d.level === 'warning').length

  const parts: string[] = []
  if (errCount) parts.push(chalk.red(`${errCount} error${errCount !== 1 ? 's' : ''}`))
  if (warnCount) parts.push(chalk.yellow(`${warnCount} warning${warnCount !== 1 ? 's' : ''}`))

  console.log()
  if (errCount > 0) {
    log.error(`${parts.join(', ')} in ${result.fileCount} file${result.fileCount !== 1 ? 's' : ''}.`)
  } else {
    log.warn(`${parts.join(', ')} in ${result.fileCount} file${result.fileCount !== 1 ? 's' : ''}.`)
  }
}

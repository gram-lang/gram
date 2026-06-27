import { defineCommand } from 'citty'
import { readFile, writeFile } from 'node:fs/promises'
import { log } from '@clack/prompts'
import chalk from 'chalk'
import { resolveGlob } from '../core/glob'
import { formatGram, hasChanges, summarizeChanges } from '../services/formatter'
import { ExitCode, GramCLIError } from '../errors'

export default defineCommand({
  meta: {
    name: 'format',
    description: 'Format .gram recipe files',
  },
  args: {
    pattern: {
      type: 'positional',
      description: 'File path or glob pattern (default: **/*.gram)',
      required: false,
    },
    check: {
      type: 'boolean',
      description: 'Check formatting without writing changes (exit 1 if any file needs formatting)',
      default: false,
    },
  },
  async run({ args }) {
    const patterns = (args._ as string[]).length > 0 ? (args._ as string[]) : ['**/*.gram']
    let files: string[]
    try {
      files = await resolveGlob(patterns)
    } catch (err) {
      if (err instanceof GramCLIError) {
        log.error(err.message)
        process.exit(err.exitCode)
      }
      throw err
    }

    const isCheck = args.check as boolean
    let needsFormatting = 0

    console.log()
    for (const file of files) {
      let source: string
      try {
        source = await readFile(file, 'utf-8')
      } catch (err) {
        log.error(`Cannot read ${file}: ${err instanceof Error ? err.message : String(err)}`)
        continue
      }

      const { content, changes } = formatGram(source)
      const changed = hasChanges(changes)

      if (!changed) {
        console.log(`  ${chalk.green('✔')} ${chalk.dim(file)}  ${chalk.dim('already formatted')}`)
        continue
      }

      needsFormatting++

      if (isCheck) {
        console.log(`  ${chalk.yellow('✗')} ${file}  ${chalk.dim(summarizeChanges(changes))}`)
      } else {
        await writeFile(file, content, 'utf-8')
        console.log(`  ${chalk.green('✔')} ${file}  ${chalk.dim(summarizeChanges(changes))}`)
      }
    }

    console.log()

    if (isCheck && needsFormatting > 0) {
      log.warn(`${needsFormatting} file${needsFormatting > 1 ? 's' : ''} need formatting. Run \`gram format\` to fix.`)
      process.exit(ExitCode.Error)
    }

    if (!isCheck && needsFormatting > 0) {
      log.success(`Formatted ${needsFormatting} file${needsFormatting > 1 ? 's' : ''}.`)
    }
  },
})

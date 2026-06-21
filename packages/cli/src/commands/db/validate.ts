import { defineCommand } from 'citty'
import { log } from '@clack/prompts'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parse } from 'yaml'
import { validateIngredientDatabase } from '@gram/analyzer'
import type { IngredientData } from '@gram/analyzer'
import { version } from '../../../package.json'
import { loadConfig } from '../../core/config'
import { validateDb } from '../../services/db-validator'
import { renderValidateResult } from '../../ui/db-validate'
import type { DbIssue } from '../../types'
import { ExitCode } from '../../errors'

export default defineCommand({
  meta: {
    name: 'validate',
    version,
    description: 'Validate the ingredient database schema and completeness',
  },
  args: {
    strict: {
      type: 'boolean',
      description: 'Exit 1 on warnings (useful in CI)',
      default: false,
    },
    db: {
      type: 'string',
      description: 'Path to ingredient database YAML (overrides config)',
    },
  },
  async run({ args }) {
    const config = await loadConfig()
    const dbPath = resolve(args.db ?? config.database ?? '.gram/ingredients.yaml')

    let rawContent: string
    try {
      rawContent = await readFile(dbPath, 'utf-8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        log.error(`No ingredient database found at ${dbPath}.`)
        log.info(`Run 'gram init' or 'gram db sync' to create one.`)
        process.exit(ExitCode.Error)
      }
      throw err
    }

    const rawParsed = parse(rawContent) as Record<string, unknown> | null
    const rawIngredients = (rawParsed?.ingredients ?? rawParsed) as unknown

    // Phase 1: Zod schema validation via @gram/analyzer
    const schemaIssues: DbIssue[] = []
    let db: Record<string, IngredientData>
    try {
      db = validateIngredientDatabase(rawIngredients)
    } catch (err) {
      if (err && typeof err === 'object' && 'issues' in err) {
        const zodErr = err as { issues: Array<{ path: (string | number)[]; message: string }> }
        for (const issue of zodErr.issues) {
          schemaIssues.push({
            level: 'error',
            category: 'Schema',
            ingredient: String(issue.path[0] ?? ''),
            message: `${issue.path.slice(1).join('.') || '(root)'}: ${issue.message}`,
          })
        }
      } else {
        schemaIssues.push({ level: 'error', category: 'Schema', message: String(err) })
      }
      renderValidateResult({
        dbPath,
        ingredientCount: 0,
        issues: schemaIssues,
        hasErrors: true,
      })
      process.exit(ExitCode.Error)
    }

    // Phase 2: Business rule checks
    const result = validateDb(db, dbPath)

    renderValidateResult(result)

    const shouldFail = result.hasErrors || (args.strict && result.issues.length > 0)
    process.exit(shouldFail ? ExitCode.Error : ExitCode.Ok)
  },
})

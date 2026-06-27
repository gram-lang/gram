import { defineCommand } from 'citty'
import { log, spinner } from '@clack/prompts'
import { relative } from 'node:path'
import { version } from '../../../package.json'
import { loadConfig } from '../../core/config'
import { loadDb } from '../../core/db'
import { loadAiModel } from '../../core/ai'
import { lintDb, applyLintDecisions } from '../../services/db-linter'
import { renderLintReport, promptLintDecisions, renderLintSummary } from '../../ui/db-lint'
import { ExitCode, GramCLIError } from '../../errors'

export default defineCommand({
  meta: {
    name: 'lint',
    version,
    description: 'Detect duplicates and plurals via AI (step 2/3 — run after sync, before enrich)',
  },
  args: {
    report: {
      type: 'boolean',
      alias: 'r',
      description: 'Show issues without applying any fixes',
      default: false,
    },
    db: {
      type: 'string',
      description: 'Path to ingredient database YAML (overrides config)',
    },
  },
  async run({ args }) {
    const config = await loadConfig()

    const db = await loadDb(config, args.db)
    if (!db) {
      log.error('No ingredient database found. Run `gram db sync` first.')
      process.exit(ExitCode.Error)
    }

    let model
    try {
      model = loadAiModel(config)
    } catch (err) {
      if (err instanceof GramCLIError) {
        log.error(err.message)
        process.exit(err.exitCode)
      }
      throw err
    }

    const s = spinner()
    s.start('Analyzing database via AI…')

    let result
    try {
      result = await lintDb(db, config, model, { dbPathOverride: args.db })
    } catch (err) {
      s.stop('Error.')
      throw err
    }

    s.stop(`Analysis complete — ${result.issues.length} issue${result.issues.length !== 1 ? 's' : ''} found.`)

    if (result.issues.length === 0 || args.report) {
      renderLintReport(result)
      process.exit(ExitCode.Ok)
    }

    renderLintReport(result)

    if (!process.stdout.isTTY) {
      log.warn('Non-interactive mode detected — run with --report to view details.')
      process.exit(ExitCode.Ok)
    }

    const decisions = await promptLintDecisions(result, db)
    const summary = await applyLintDecisions(result, decisions)
    renderLintSummary(summary, relative(process.cwd(), result.dbPath) || result.dbPath)

    process.exit(ExitCode.Ok)
  },
})

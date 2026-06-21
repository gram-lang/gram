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
    description: 'Detect duplicates and malformed plurals in the ingredient database via AI',
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
    s.start('Analyse de la base via AI…')

    let result
    try {
      result = await lintDb(db, config, model, { dbPathOverride: args.db })
    } catch (err) {
      s.stop('Erreur.')
      throw err
    }

    s.stop(`Analyse terminée — ${result.issues.length} problème${result.issues.length !== 1 ? 's' : ''} trouvé${result.issues.length !== 1 ? 's' : ''}.`)

    if (result.issues.length === 0 || args.report) {
      renderLintReport(result)
      process.exit(ExitCode.Ok)
    }

    renderLintReport(result)

    if (!process.stdout.isTTY) {
      log.warn('Mode non-interactif détecté — relancez avec --report pour voir les détails.')
      process.exit(ExitCode.Ok)
    }

    const decisions = await promptLintDecisions(result)
    const summary = await applyLintDecisions(result, decisions)
    renderLintSummary(summary, relative(process.cwd(), result.dbPath) || result.dbPath)

    process.exit(ExitCode.Ok)
  },
})

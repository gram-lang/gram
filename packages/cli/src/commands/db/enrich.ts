import { defineCommand } from 'citty'
import { log } from '@clack/prompts'
import { version } from '../../../package.json'
import { loadConfig } from '../../core/config'
import { loadDb } from '../../core/db'
import { loadAiClient } from '../../core/ai'
import { enrichDb } from '../../services/db-enricher'
import { renderEnrichResult } from '../../ui/db-enrich'
import { ExitCode, GramCLIError } from '../../errors'

export default defineCommand({
  meta: { name: 'enrich', version, description: 'Fill in missing density and nutrition data via AI' },
  args: {
    ingredient: {
      type: 'string',
      description: 'Enrich a single ingredient by slug',
    },
    field: {
      type: 'string',
      description: 'Field to enrich: density | nutrition | all (default: all)',
      default: 'all',
    },
    'dry-run': {
      type: 'boolean',
      alias: 'n',
      description: 'Preview what would be written without writing',
      default: false,
    },
    db: {
      type: 'string',
      description: 'Path to ingredient database YAML (overrides config)',
    },
  },
  async run({ args }) {
    const field = args.field as 'density' | 'nutrition' | 'all'
    if (!['density', 'nutrition', 'all'].includes(field)) {
      log.error(`Invalid --field "${field}". Use density, nutrition, or all.`)
      process.exit(ExitCode.Error)
    }

    const config = await loadConfig()

    const db = await loadDb(config, args.db)
    if (!db) {
      log.error('No ingredient database found. Run `gram db sync` first.')
      process.exit(ExitCode.Error)
    }

    let ai
    try {
      ai = loadAiClient(config)
    } catch (err) {
      if (err instanceof GramCLIError) {
        log.error(err.message)
        process.exit(err.exitCode)
      }
      throw err
    }

    const result = await enrichDb(db, config, ai, {
      ingredient: args.ingredient,
      field,
      dryRun: args['dry-run'],
      dbPathOverride: args.db,
    })

    renderEnrichResult(result, args['dry-run'])
    process.exit(ExitCode.Ok)
  },
})

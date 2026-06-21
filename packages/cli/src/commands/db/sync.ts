import { defineCommand } from 'citty'
import { log } from '@clack/prompts'
import { version } from '../../../package.json'
import { loadConfig } from '../../core/config'
import { resolveGlob } from '../../core/glob'
import { syncIngredients } from '../../services/db-sync'
import { renderSyncResult } from '../../ui/db-sync'
import { ExitCode, GramCLIError } from '../../errors'

export default defineCommand({
  meta: {
    name: 'sync',
    version,
    description: 'Add missing ingredient stubs from recipes to the database',
  },
  args: {
    pattern: {
      type: 'positional',
      required: false,
      description: 'File path or glob (default: **/*.gram)',
    },
    'dry-run': {
      type: 'boolean',
      alias: 'n',
      description: 'Show what would be added without writing to disk',
      default: false,
    },
    db: {
      type: 'string',
      description: 'Path to ingredient database YAML (overrides config)',
    },
  },
  async run({ args }) {
    const patterns = (args._ as string[]).length > 0 ? (args._ as string[]) : ['**/*.gram']
    let files: string[]
    try {
      files = resolveGlob(patterns)
    } catch (err) {
      if (err instanceof GramCLIError) {
        log.error(err.message)
        process.exit(err.exitCode)
      }
      throw err
    }

    const config = await loadConfig()
    const result = await syncIngredients(files, config, {
      dbPathOverride: args.db,
      dryRun: args['dry-run'],
    })

    renderSyncResult(result, args['dry-run'])
    process.exit(ExitCode.Ok)
  },
})

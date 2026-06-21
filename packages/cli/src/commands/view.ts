import { defineCommand } from 'citty'
import { log } from '@clack/prompts'
import { version } from '../../package.json'
import { loadConfig } from '../core/config'
import { loadDb } from '../core/db'
import { buildViewModel } from '../services/viewer'
import { outputRecipe } from '../ui/viewer'
import { ExitCode, GramCLIError } from '../errors'

export default defineCommand({
  meta: { name: 'view', version, description: 'Display a recipe in the terminal' },
  args: {
    file: {
      type: 'positional',
      required: true,
      description: 'Path to a .gram recipe file',
    },
    db: {
      type: 'string',
      description: 'Ingredient database YAML (overrides config) — enables nutrition',
    },
    'skip-db': {
      type: 'boolean',
      description: 'Ignore the database even if configured',
    },
    'no-pager': {
      type: 'boolean',
      description: 'Disable automatic pager for long recipes',
    },
  },
  async run({ args }) {
    const file = args.file as string
    const config = await loadConfig()

    let db: Record<string, any> | null = null
    if (!args['skip-db']) {
      db = await loadDb(config, args.db)
    }

    let model
    try {
      model = await buildViewModel(file, { db })
    } catch (err) {
      if (err instanceof GramCLIError) {
        log.error(err.message)
        process.exit(err.exitCode)
      }
      throw err
    }

    await outputRecipe(model, args['no-pager'] ?? false)
    process.exit(ExitCode.Ok)
  },
})

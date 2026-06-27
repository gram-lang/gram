import { defineCommand } from 'citty'
import { resolve } from 'node:path'
import { log, spinner } from '@clack/prompts'
import { version } from '../../package.json'
import { loadConfig } from '../core/config'
import { loadDbSafe } from '../core/db'
import { computeScale } from '../services/scaler'
import { renderScaleResult } from '../ui/scaler'
import { ExitCode } from '../errors'

export default defineCommand({
  meta: {
    name: 'scale',
    version,
    description: 'Display a recipe scaled by a factor or matched to a reference ingredient quantity',
  },
  args: {
    file: {
      type: 'positional',
      required: true,
      description: '.gram recipe file to scale',
    },
    factor: {
      type: 'string',
      description: 'Scale factor to apply (e.g. 2, 0.5, 1.5)',
    },
    ref: {
      type: 'string',
      description: 'Reference ingredient and target quantity: id=value (e.g. farine=300g, oeufs=3)',
    },
    db: {
      type: 'string',
      description: 'Path to ingredient database YAML',
    },
    'skip-db': {
      type: 'boolean',
      description: 'Skip ingredient database',
      default: false,
    },
  },
  async run({ args }) {
    if (!args.factor && !args.ref) {
      log.error('Provide either --factor <n> or --ref <id=value>. Run "gram scale --help" for examples.')
      process.exit(ExitCode.Error)
    }
    if (args.factor && args.ref) {
      log.error('--factor and --ref are mutually exclusive.')
      process.exit(ExitCode.Error)
    }

    let factor: number | undefined
    if (args.factor) {
      factor = parseFloat(args.factor as string)
      if (isNaN(factor) || factor <= 0) {
        log.error('--factor must be a positive number (e.g. 2, 0.75).')
        process.exit(ExitCode.Error)
      }
    }

    const filePath = resolve(args.file as string)
    const config = await loadConfig()
    const db = args['skip-db'] ? null : await loadDbSafe(config, args.db)

    const s = spinner()
    s.start('Computing scaled quantities…')

    let result
    try {
      result = await computeScale(filePath, factor, args.ref as string | undefined, db)
      s.stop('Done.')
    } catch (err) {
      s.stop('Failed.')
      log.error(err instanceof Error ? err.message : String(err))
      process.exit(ExitCode.Error)
    }

    renderScaleResult(result)
  },
})

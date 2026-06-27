import { defineCommand } from 'citty'
import { resolve } from 'node:path'
import { log } from '@clack/prompts'
import chalk from 'chalk'
import { loadConfig } from '../core/config'
import { loadDbSafe } from '../core/db'
import { resolveScaleArg } from '../services/scaler'
import { generatePrintHTML, openInBrowser } from '../services/printer'
import { ExitCode, GramCLIError } from '../errors'

export default defineCommand({
  meta: {
    name: 'print',
    description: 'Generate a print-ready HTML and open it in the browser',
  },
  args: {
    file: {
      type: 'positional',
      required: true,
      description: 'Path to a .gram recipe file',
    },
    open: {
      type: 'boolean',
      description: 'Open the generated HTML in the browser (use --no-open to skip)',
      default: true,
    },
    scale: {
      type: 'string',
      description: 'Scale factor (e.g. 1.5) or reference ingredient (e.g. farine=300g)',
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
    const filePath = resolve(args.file as string)
    const config = await loadConfig()
    const db = args['skip-db'] ? null : await loadDbSafe(config, args.db)

    const scaleFactor = await resolveScaleArg(args.scale as string | undefined, filePath, db)

    let htmlPath: string
    try {
      htmlPath = await generatePrintHTML(filePath, db, scaleFactor)
    } catch (err) {
      if (err instanceof GramCLIError) {
        log.error(err.message)
        process.exit(err.exitCode)
      }
      throw err
    }

    log.success(`HTML generated: ${chalk.dim(htmlPath)}`)

    if (args.open !== false) {
      const opened = openInBrowser(htmlPath)
      if (opened) {
        log.info('Opening in browser…')
      } else {
        log.warn(`Could not open browser automatically. Open the file manually:\n${htmlPath}`)
      }
    }
  },
})

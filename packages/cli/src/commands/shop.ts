import { defineCommand } from 'citty'
import { writeFile } from 'node:fs/promises'
import { log } from '@clack/prompts'
import { loadConfig } from '../core/config'
import { loadDbSafe } from '../core/db'
import { resolveGlob } from '../core/glob'
import { buildShoppingList } from '../services/shopper'
import { parseScaleArg } from '../services/scaler'
import { renderShopTerminal, renderShopMarkdown, renderShopJson } from '../ui/shop'
import { ExitCode, GramCLIError } from '../errors'

export default defineCommand({
  meta: {
    name: 'shop',
    description: 'Generate an aggregated shopping list from recipes',
  },
  args: {
    pattern: {
      type: 'positional',
      required: false,
      description: 'File path or glob (default: **/*.gram)',
    },
    scale: {
      type: 'string',
      description: 'Scale factor applied to all recipes (e.g. 2, 0.5)',
    },
    format: {
      type: 'string',
      description: 'terminal (default) · md (markdown checklist) · json',
      default: 'terminal',
    },
    output: {
      type: 'string',
      alias: 'o',
      description: 'Write output to a file instead of stdout',
    },
    db: {
      type: 'string',
      description: 'Path to ingredient database YAML (overrides config)',
    },
    'skip-db': {
      type: 'boolean',
      description: 'Skip database — no name resolution, aggregation by unit only',
      default: false,
    },
  },
  async run({ args }) {
    const isRawOutput = (args.format === 'json' || args.format === 'md') && !args.output

    let scaleFactor: number | undefined
    if (args.scale) {
      try {
        const parsed = parseScaleArg(args.scale as string)
        if (parsed.type === 'ref') {
          log.error('Reference mode (id=value) is not available for gram shop. Use a numeric factor (e.g. --scale 2).')
          process.exit(ExitCode.Error)
        }
        scaleFactor = parsed.value
      } catch (err) {
        log.error(err instanceof Error ? err.message : String(err))
        process.exit(ExitCode.Error)
      }
    }

    const patterns = (args._ as string[]).length > 0 ? (args._ as string[]) : ['**/*.gram']
    let files: string[]
    try {
      files = await resolveGlob(patterns)
    } catch (err) {
      if (err instanceof GramCLIError) {
        if (isRawOutput) {
          process.stderr.write(`gram shop: ${err.message}\n`)
        } else {
          log.error(err.message)
        }
        process.exit(err.exitCode)
      }
      throw err
    }

    const config = await loadConfig()
    const db = args['skip-db'] ? null : await loadDbSafe(config, args.db)
    const result = await buildShoppingList(files, { db, scaleFactor })

    if (args.format === 'json') {
      const json = renderShopJson(result)
      if (args.output) {
        await writeFile(args.output, `${json}\n`)
        log.success(`Wrote shopping list to ${args.output}`)
      } else {
        process.stdout.write(`${json}\n`)
      }
      return
    }

    if (args.format === 'md') {
      const md = renderShopMarkdown(result)
      if (args.output) {
        await writeFile(args.output, md)
        log.success(`Wrote shopping list to ${args.output}`)
      } else {
        process.stdout.write(`${md}\n`)
      }
      return
    }

    renderShopTerminal(result)
  },
})

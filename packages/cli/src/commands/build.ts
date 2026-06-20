import { defineCommand } from 'citty'
import { spinner, log } from '@clack/prompts'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import chalk from 'chalk'
import { loadConfig } from '../core/config'
import { loadDb } from '../core/db'
import { resolveGlob } from '../core/glob'
import { buildFiles } from '../services/builder'
import { ExitCode, GramCLIError } from '../errors'

export default defineCommand({
  meta: {
    name: 'build',
    description: 'Compile .gram recipes to JSON',
  },
  args: {
    pattern: {
      type: 'positional',
      description: 'File path or glob pattern (default: **/*.gram)',
      required: false,
    },
    output: {
      type: 'string',
      alias: 'o',
      description: 'Output directory (omit to write JSON to stdout)',
    },
    pretty: {
      type: 'boolean',
      description: 'Pretty-print JSON output',
      default: false,
    },
    db: {
      type: 'string',
      description: 'Path to ingredient database YAML',
    },
    'skip-db': {
      type: 'boolean',
      description: 'Skip ingredient database enrichment',
      default: false,
    },
  },
  async run({ args }) {
    const toStdout = !args.output

    // In pipe mode, ALL errors must go to stderr to preserve stdout purity
    if (toStdout) {
      try {
        await runToStdout(args)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        process.stderr.write(`gram build: ${msg}\n`)
        process.exit(ExitCode.Error)
      }
      return
    }

    await runToFiles(args)
  },
})

type Args = {
  _: string[]
  pattern?: string
  output?: string
  pretty: boolean
  db?: string
  'skip-db': boolean
}

async function resolveInputs(args: Args) {
  const patterns = args._.length > 0 ? args._ : ['**/*.gram']
  let files: string[] = []
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
  const db = args['skip-db'] ? null : await loadDb(config, args.db)
  return { files, db }
}

async function runToStdout(args: Args) {
  const { files, db } = await resolveInputs(args)
  const results = await buildFiles(files, { db: db ?? undefined })
  const indent = args.pretty ? 2 : undefined
  for (const { data } of results) {
    process.stdout.write(JSON.stringify(data, null, indent) + '\n')
  }
}

async function runToFiles(args: Args) {
  const { files, db } = await resolveInputs(args)
  const outDir = args.output!
  const n = files.length

  const s = spinner()
  s.start(`Building ${n} file${n !== 1 ? 's' : ''}…`)

  const results = await buildFiles(files, { db: db ?? undefined })

  s.stop(`Built ${n} file${n !== 1 ? 's' : ''}.`)

  await mkdir(outDir, { recursive: true })

  const indent = args.pretty ? 2 : undefined
  await Promise.all(
    results.map(({ slug, data }) =>
      writeFile(join(outDir, `${slug}.json`), JSON.stringify(data, null, indent) + '\n'),
    ),
  )

  log.success(`Wrote ${results.length} JSON file${results.length !== 1 ? 's' : ''} to ${chalk.dim(outDir)}.`)
}

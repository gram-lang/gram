import { defineCommand } from 'citty'
import { resolve, extname } from 'node:path'
import { log } from '@clack/prompts'
import { version } from '../../../package.json'
import { loadConfig } from '../../core/config'
import { resolveDbPath } from '../../core/db'
import { loadDb } from '../../core/db'
import { loadSourceDb, analyzeMerge, applyMerge } from '../../services/db-merger'
import { renderMergePreview, resolveConflictsInteractively, renderMergeResult } from '../../ui/db-merge'
import type { PreferSide } from '../../services/db-merger'
import { ExitCode } from '../../errors'

const ALLOWED_EXTENSIONS = ['.yaml', '.yml']

export default defineCommand({
  meta: {
    name: 'merge',
    version,
    description: 'Merge another ingredient database into the local one',
  },
  args: {
    source: {
      type: 'positional',
      required: true,
      description: 'Path to source YAML database file to merge from',
    },
    prefer: {
      type: 'string',
      description: 'Conflict resolution: local (default) or remote',
    },
    'dry-run': {
      type: 'boolean',
      description: 'Preview changes without writing',
      default: false,
    },
    'only-new': {
      type: 'boolean',
      description: 'Only add new entries, skip enrichment and conflict resolution',
      default: false,
    },
    db: {
      type: 'string',
      description: 'Path to target ingredient database YAML (overrides config)',
    },
  },
  async run({ args }) {
    const sourcePath = resolve(args.source as string)
    const ext = extname(sourcePath).toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      log.error(`Source must be a YAML file (.yaml or .yml). Got: ${sourcePath}`)
      process.exit(ExitCode.Error)
    }

    const prefer = args.prefer as string | undefined
    if (prefer && prefer !== 'local' && prefer !== 'remote') {
      log.error(`--prefer must be "local" or "remote".`)
      process.exit(ExitCode.Error)
    }

    const config = await loadConfig()
    const dbPath = resolveDbPath(config, args.db as string | undefined)

    const localDb = await loadDb(config, args.db as string | undefined)
    if (!localDb) {
      log.error(`No ingredient database found at ${dbPath}.`)
      log.info(`Run 'gram init' or 'gram db sync' to create one.`)
      process.exit(ExitCode.Error)
    }

    let sourceDb: Record<string, import('@gram/analyzer').IngredientData>
    try {
      sourceDb = await loadSourceDb(sourcePath)
    } catch (err) {
      log.error((err as Error).message)
      process.exit(ExitCode.Error)
    }

    const analysis = await analyzeMerge(
      localDb,
      sourceDb,
      dbPath,
      Boolean(args['only-new']),
    )

    renderMergePreview(analysis)

    const total = analysis.toAdd.length + analysis.toEnrich.length + analysis.conflicts.length
    if (total === 0) return

    let resolvedConflicts = new Map<string, PreferSide>()
    let skippedConflicts = 0

    if (analysis.conflicts.length > 0) {
      const result = await resolveConflictsInteractively(
        analysis.conflicts,
        prefer as PreferSide | undefined,
      )
      if (!result) process.exit(ExitCode.Error)
      resolvedConflicts = result

      // Count conflicts kept as local (skipped)
      for (const { localKey, field } of analysis.conflicts) {
        const side = resolvedConflicts.get(`${localKey}:${field}`)
        if (!side || side === 'local') skippedConflicts++
      }
    }

    await applyMerge(analysis, resolvedConflicts, Boolean(args['dry-run']))
    renderMergeResult(analysis, Boolean(args['dry-run']), skippedConflicts)
  },
})

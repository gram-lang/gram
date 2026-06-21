import { defineCommand } from 'citty'
import { log, select, note } from '@clack/prompts'
import { version } from '../../../package.json'
import { loadConfig } from '../../core/config'
import { loadDb } from '../../core/db'
import { resolveGlob } from '../../core/glob'
import { analyzeIngredients, applySync } from '../../services/db-sync'
import { renderSyncResult } from '../../ui/db-sync'
import { ExitCode, GramCLIError } from '../../errors'
import type { FuzzyMatch } from '../../types'

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
      files = await resolveGlob(patterns)
    } catch (err) {
      if (err instanceof GramCLIError) {
        log.error(err.message)
        process.exit(err.exitCode)
      }
      throw err
    }

    const config = await loadConfig()
    const db = (await loadDb(config, args.db)) ?? {}

    const analysis = await analyzeIngredients(files, db, config, {
      dbPathOverride: args.db,
    })

    const decisions = new Map<string, string>()

    // Genuinely new entries are created automatically
    for (const id of analysis.genuinelyNew) {
      decisions.set(id, 'new')
    }

    // Fuzzy matches require a decision
    if (analysis.fuzzyMatches.length > 0) {
      if (!process.stdout.isTTY || args['dry-run']) {
        // CI / non-interactive: create as new, emit warnings
        for (const match of analysis.fuzzyMatches) {
          decisions.set(match.newId, 'new')
        }
        if (process.stdout.isTTY && args['dry-run']) {
          note(
            analysis.fuzzyMatches
              .map(m => `"${m.newId}" ≈ "${m.existingId}" (${pct(m.score)}%)`)
              .join('\n'),
            'Near-duplicates detected (dry-run)',
          )
        } else {
          for (const match of analysis.fuzzyMatches) {
            log.warn(
              `"${match.newId}" ressemble à "${match.existingId}" (${pct(match.score)}%) — créé comme nouvelle entrée (mode non-interactif)`,
            )
          }
        }
      } else {
        for (const match of analysis.fuzzyMatches) {
          const decision = await promptFuzzyMatch(match)
          if (typeof decision !== 'symbol') {
            decisions.set(match.newId, decision)
          }
        }
      }
    }

    const opts = { dryRun: args['dry-run'], dbPathOverride: args.db }
    const result = await applySync(analysis, decisions, opts)

    renderSyncResult(result, args['dry-run'])
    process.exit(ExitCode.Ok)
  },
})

function pct(score: number): number {
  return Math.round(score * 100)
}

async function promptFuzzyMatch(match: FuzzyMatch): Promise<string> {
  const answer = await select({
    message: `"${match.newId}" ressemble à "${match.existingId}" (${pct(match.score)}% de similarité)`,
    options: [
      {
        value: `alias-of:${match.existingId}`,
        label: `Ajouter comme alias de "${match.existingId}"`,
        hint: 'recommandé — zéro doublon, rétrocompatible',
      },
      {
        value: 'new',
        label: 'Créer une nouvelle entrée indépendante',
        hint: 'si c\'est réellement un ingrédient différent',
      },
      {
        value: 'ignore',
        label: 'Ignorer pour l\'instant',
      },
    ],
  })
  return typeof answer === 'symbol' ? 'ignore' : answer
}

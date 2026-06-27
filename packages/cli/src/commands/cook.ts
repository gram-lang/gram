import { defineCommand } from 'citty'
import { resolve } from 'node:path'
import { log, spinner } from '@clack/prompts'
import chalk from 'chalk'
import { render } from 'ink'
import React from 'react'
import { version } from '../../package.json'
import { loadConfig } from '../core/config'
import { loadDbSafe } from '../core/db'
import { runPipeline } from '../core/pipeline'
import { resolveScaleFactor, getScaleWarnings } from '../services/scaler'
import { prepareRecipeData } from '../ui/cook/prepare'
import App from '../ui/cook/App'
import { ExitCode } from '../errors'

export default defineCommand({
  meta: {
    name: 'cook',
    version,
    description: 'Interactive step-by-step cooking guide for a recipe',
  },
  args: {
    file: {
      type: 'positional',
      required: true,
      description: '.gram recipe file to cook',
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

    let scaleFactor = 1
    if (args.scale) {
      try {
        scaleFactor = await resolveScaleFactor(filePath, args.scale as string, db)
      } catch (err) {
        log.error(err instanceof Error ? err.message : String(err))
        process.exit(ExitCode.Error)
      }
    }

    const s = spinner()
    s.start('Loading recipe…')

    let recipe
    let totalTime = 0
    try {
      const { compiled } = await runPipeline(filePath, { db, skipAnalyzer: !db, scaleFactor })
      totalTime = compiled.metrics?.totalTime ?? 0
      recipe = prepareRecipeData(compiled)
      const factorStr =
        scaleFactor !== 1
          ? ` ${chalk.dim(scaleFactor === Math.round(scaleFactor) ? `(x${scaleFactor})` : `(x${scaleFactor.toFixed(2)})`)}` : ''
      s.stop(`${recipe.title ?? 'Recipe'}${factorStr} — ${recipe.steps.length} step${recipe.steps.length !== 1 ? 's' : ''} ready.`)
    } catch (err) {
      s.stop('Failed.')
      log.error(err instanceof Error ? err.message : String(err))
      process.exit(ExitCode.Error)
    }

    if (recipe.steps.length === 0) {
      log.warn('This recipe has no steps to cook.')
      process.exit(ExitCode.Ok)
    }

    if (scaleFactor !== 1) {
      const warnings = getScaleWarnings(scaleFactor, totalTime)
      for (const w of warnings) log.warn(w)
    }

    const { waitUntilExit } = render(React.createElement(App, { recipe }))
    await waitUntilExit()
  },
})

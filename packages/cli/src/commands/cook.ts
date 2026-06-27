import { defineCommand } from 'citty'
import { resolve } from 'node:path'
import { log, spinner } from '@clack/prompts'
import { render } from 'ink'
import React from 'react'
import { version } from '../../package.json'
import { loadConfig } from '../core/config'
import { loadDbSafe } from '../core/db'
import { runPipeline } from '../core/pipeline'
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

    const s = spinner()
    s.start('Loading recipe…')

    let recipe
    try {
      const { compiled } = await runPipeline(filePath, { db, skipAnalyzer: !db })
      recipe = prepareRecipeData(compiled)
      s.stop(`${recipe.title ?? 'Recipe'} — ${recipe.steps.length} step${recipe.steps.length !== 1 ? 's' : ''} ready.`)
    } catch (err) {
      s.stop('Failed.')
      log.error(err instanceof Error ? err.message : String(err))
      process.exit(ExitCode.Error)
    }

    if (recipe.steps.length === 0) {
      log.warn('This recipe has no steps to cook.')
      process.exit(ExitCode.Ok)
    }

    const { waitUntilExit } = render(React.createElement(App, { recipe }))
    await waitUntilExit()
  },
})

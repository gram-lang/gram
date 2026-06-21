import { defineCommand } from 'citty'
import { intro, outro, confirm, isCancel, cancel, note } from '@clack/prompts'
import { mkdir, writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { stringify } from 'yaml'
import type { GramConfig } from '../types'
import { ExitCode } from '../errors'

const DB_TEMPLATE = `# GRAM ingredient database
# Keys are slugs matching @ingredient names used in your .gram recipes.
# Full schema reference: packages/analyzer/tests/fixtures/ingredients.yaml
#
# ingredients:
#   butter:
#     name: Butter
#     aliases: [unsalted butter, sweet cream butter]
#     tags: [dairy, fat]
#     physical:
#       density: 0.91
#       yield: 1.0
#     nutrition:
#       calories: 717
#       protein: 0.9
#       carbs: 0.1
#       fat: 81
#       sat_fat: 51.4
#       mono_fat: 21.0
#       poly_fat: 3.0
#       sodium: 0.011
`

function guardCancel<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel('Initialisation annulée.')
    process.exit(ExitCode.Ok)
  }
  return value as T
}

export default defineCommand({
  meta: {
    name: 'init',
    description: 'Initialize a GRAM project in the current directory',
  },
  async run() {
    intro('gram init')

    const gramDir = join(process.cwd(), '.gram')
    const configPath = join(gramDir, 'config.yaml')

    let alreadyExists = false
    try {
      await access(configPath)
      alreadyExists = true
    } catch { }

    if (alreadyExists) {
      const proceed = guardCancel(
        await confirm({
          message: '.gram/config.yaml already exists. Overwrite?',
          initialValue: false,
        }),
      )
      if (!proceed) {
        cancel('Nothing changed.')
        process.exit(ExitCode.Ok)
      }
    }

    const createDb = guardCancel(
      await confirm({
        message: 'Create an ingredient database template?',
        initialValue: true,
      }),
    )

    const config: GramConfig = {
      ...(createDb && { database: '.gram/ingredients.yaml' }),
    }

    await mkdir(gramDir, { recursive: true })
    await writeFile(configPath, stringify(config))

    if (createDb) {
      const dbPath = join(gramDir, 'ingredients.yaml')
      let dbExists = false
      try {
        await access(dbPath)
        dbExists = true
      } catch { }

      if (!dbExists) {
        await writeFile(dbPath, DB_TEMPLATE)
      }
    }

    const gitignorePath = join(gramDir, '.gitignore')
    let gitignoreExists = false
    try {
      await access(gitignorePath)
      gitignoreExists = true
    } catch { }
    if (!gitignoreExists) {
      await writeFile(gitignorePath, '# Prevent committing sensitive API keys if used in config\n*.key\n.env*\n')
    }

    const nextSteps = [
      'Edit .gram/config.yaml to adjust your project settings.',
      createDb ? 'Fill .gram/ingredients.yaml with your ingredient data.' : '',
      'Run gram check <file> to validate a recipe.',
    ]
      .filter(Boolean)
      .join('\n')

    note(nextSteps, 'Next steps')
    outro('Done!')
  },
})

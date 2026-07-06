import { defineCommand } from 'citty'
import { log } from '@clack/prompts'
import {
  getLocalConfigPath,
  getGlobalConfigPath,
  getConfigValue,
} from '../../services/config-manager'
import { requireProjectRoot, findProjectRoot } from '../../core/workspace'
import { ExitCode } from '../../errors'

export default defineCommand({
  meta: { name: 'get', description: 'Get a configuration value' },
  args: {
    key: {
      type: 'positional',
      required: true,
      description: 'Config key in dot notation (e.g. ai.provider, database)',
    },
    global: {
      type: 'boolean',
      description: 'Read from global config (~/.config/gram/config.yaml)',
      default: false,
    },
  },
  async run({ args }) {
    const projectRoot = args.global ? await findProjectRoot() : await requireProjectRoot()
    const configPath = args.global
      ? getGlobalConfigPath()
      : getLocalConfigPath(projectRoot)

    const value = await getConfigValue(args.key as string, configPath, projectRoot)

    if (value === undefined) {
      log.warn(`Key "${args.key}" is not set.`)
      process.exit(ExitCode.Error)
    }

    process.stdout.write(`${value}\n`)
  },
})

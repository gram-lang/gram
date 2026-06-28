import { defineCommand } from 'citty'
import chalk from 'chalk'
import {
  getLocalConfigPath,
  getGlobalConfigPath,
  snapshotConfig,
  flattenConfig,
  getEnvVarName,
  getNestedKey,
} from '../../services/config-manager'
import { findProjectRoot } from '../../core/workspace'

function renderSection(
  label: string,
  path: string,
  flat: Record<string, any>,
  envVars: Record<string, string>,
  localConfig: Record<string, any>,
): void {
  const separator = '─'.repeat(Math.max(label.length + path.length + 4, 40))
  console.log()
  console.log(`  ${chalk.bold(label)}  ${chalk.dim(path)}`)
  console.log(`  ${chalk.dim(separator)}`)

  const entries = Object.entries(flat)
  if (entries.length === 0) {
    console.log(`  ${chalk.dim('(empty)')}`)
    return
  }

  const maxKey = Math.max(...entries.map(([k]) => k.length), 12)

  for (const [key, value] of entries) {
    const isSensitive = key === 'ai.apiKey'
    let display: string

    if (isSensitive) {
      const provider = getNestedKey(localConfig, 'ai.provider')
      const envVar = getEnvVarName(provider)
      const envValue = envVars[envVar]
      const yamlValue = getNestedKey(localConfig, key)
      if (envValue) {
        display = chalk.dim(`***  (${envVar} in .env)`)
      } else if (yamlValue) {
        display = chalk.yellow(`***  (in config.yaml — move to .env for security)`)
      } else {
        display = chalk.dim(`not set  (would use ${envVar} from .env)`)
      }
    } else {
      display = chalk.green(String(value))
    }

    console.log(`  ${key.padEnd(maxKey + 2)} ${display}`)
  }
}

function addApiKeyRow(
  label: string,
  path: string,
  flat: Record<string, any>,
  envVars: Record<string, string>,
  localConfig: Record<string, any>,
): void {
  const provider = getNestedKey(localConfig, 'ai.provider')
  const envVar = getEnvVarName(provider)
  const hasKey = envVar in envVars

  if (hasKey && !('ai.apiKey' in flat)) {
    flat['ai.apiKey'] = '__sensitive__'
  }
}

export default defineCommand({
  meta: { name: 'list', description: 'List all configuration values' },
  args: {},
  async run() {
    const projectRoot = await findProjectRoot()
    const localPath = getLocalConfigPath(projectRoot)
    const globalPath = getGlobalConfigPath()

    const { local, global, envVars } = await snapshotConfig(localPath, globalPath, projectRoot)

    const localFlat = flattenConfig(local)
    addApiKeyRow('Local config', localPath, localFlat, envVars, local)

    const globalFlat = flattenConfig(global)

    renderSection('Local config', localPath.replace(projectRoot, '.'), localFlat, envVars, local)
    renderSection('Global config', globalPath.replace(process.env.HOME ?? '', '~'), globalFlat, envVars, global)
    console.log()
  },
})

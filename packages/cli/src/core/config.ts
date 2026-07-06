import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'
import { defu } from 'defu'
import { z } from 'zod'
import { GramConfigFileSchema, type GramConfig } from '../types'
import { GramConfigError } from '../errors'
import { findProjectRoot } from './workspace'

export { findProjectRoot }

async function readYaml(path: string): Promise<Partial<GramConfig>> {
  try {
    const content = await readFile(path, 'utf-8')
    return parse(content) ?? {}
  } catch {
    return {}
  }
}

export async function loadConfig(): Promise<GramConfig> {
  const projectRoot = await findProjectRoot()
  const global = await readYaml(join(homedir(), '.config', 'gram', 'config.yaml'))
  const project = await readYaml(join(projectRoot, '.gram', 'config.yaml'))

  // Project config takes priority over global defaults
  const merged = defu(project, global)

  const result = GramConfigFileSchema.safeParse(merged)
  if (!result.success) {
    throw new GramConfigError(
      `Invalid configuration in .gram/config.yaml or ~/.config/gram/config.yaml:\n${z.prettifyError(result.error)}`,
    )
  }
  const config: GramConfig = result.data

  // API keys from env vars — provider resolution happens in loadAiModel()
  if (!config.ai?.apiKey) {
    if (process.env.GEMINI_API_KEY) config.ai = { ...config.ai, apiKey: process.env.GEMINI_API_KEY }
    else if (process.env.OPENAI_API_KEY) config.ai = { ...config.ai, apiKey: process.env.OPENAI_API_KEY }
    else if (process.env.ANTHROPIC_API_KEY) config.ai = { ...config.ai, apiKey: process.env.ANTHROPIC_API_KEY }
  }

  config.projectRoot = projectRoot

  return config
}

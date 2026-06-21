import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'
import { defu } from 'defu'
import type { GramConfig } from '../types.ts'
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
  const merged = defu(project, global) as GramConfig

  // API keys from env vars — provider resolution happens in loadAiModel()
  if (!merged.ai?.apiKey) {
    if (process.env.GEMINI_API_KEY) merged.ai = { ...merged.ai, apiKey: process.env.GEMINI_API_KEY }
    else if (process.env.OPENAI_API_KEY) merged.ai = { ...merged.ai, apiKey: process.env.OPENAI_API_KEY }
    else if (process.env.ANTHROPIC_API_KEY) merged.ai = { ...merged.ai, apiKey: process.env.ANTHROPIC_API_KEY }
  }

  merged.projectRoot = projectRoot

  return merged
}

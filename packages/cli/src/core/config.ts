import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'
import { defu } from 'defu'
import type { GramConfig } from '../types.ts'

async function readYaml(path: string): Promise<Partial<GramConfig>> {
  try {
    const content = await readFile(path, 'utf-8')
    return parse(content) ?? {}
  } catch {
    return {}
  }
}

export async function loadConfig(): Promise<GramConfig> {
  const global = await readYaml(join(homedir(), '.config', 'gram', 'config.yaml'))
  const project = await readYaml(join(process.cwd(), '.gram', 'config.yaml'))

  // Project config takes priority over global defaults
  const merged = defu(project, global) as GramConfig

  // Environment variable always wins over config files
  if (process.env.GEMINI_API_KEY) {
    merged.ai = { provider: 'gemini', ...merged.ai, apiKey: process.env.GEMINI_API_KEY }
  }

  return merged
}

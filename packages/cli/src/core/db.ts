import { readFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { parse } from 'yaml'
import { validateIngredientDatabase } from '@gram/analyzer'
import type { IngredientData } from '@gram/analyzer'
import type { GramConfig } from '../types'
import { GramConfigError, ExitCode } from '../errors'
import { log } from '@clack/prompts'

function resolveDbPath(config: GramConfig, overridePath?: string): string {
  const root = config.projectRoot ?? process.cwd()
  if (overridePath) return resolve(overridePath)
  if (config.database) return resolve(root, config.database)
  return join(root, '.gram', 'ingredients.yaml')
}

export async function loadDb(
  config: GramConfig,
  overridePath?: string,
): Promise<Record<string, IngredientData> | null> {
  const dbPath = resolveDbPath(config, overridePath)

  let raw: unknown
  try {
    const content = await readFile(dbPath, 'utf-8')
    raw = parse(content)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw new GramConfigError(
      `Cannot read ingredient database at ${dbPath}: ${(err as Error).message}`,
    )
  }

  // Empty file (comments-only YAML parses to null) = no database
  if (raw == null) return null

  // Support both formats: with or without top-level 'ingredients:' wrapper.
  // If the wrapper key exists but is null/empty (e.g. `ingredients:` with no entries),
  // treat as an empty database rather than an error.
  const rawObj = raw as Record<string, unknown>
  const hasWrapper = typeof rawObj === 'object' && 'ingredients' in rawObj
  const ingredients = hasWrapper ? (rawObj.ingredients ?? {}) : raw

  try {
    return validateIngredientDatabase(ingredients)
  } catch (err) {
    throw new GramConfigError(
      `Invalid ingredient database at ${dbPath}: ${(err as Error).message}`,
    )
  }
}

export async function loadDbSafe(
  config: GramConfig,
  overridePath?: string,
): Promise<Record<string, IngredientData> | null> {
  try {
    return await loadDb(config, overridePath)
  } catch (err) {
    if (err instanceof GramConfigError) {
      log.error(err.message)
      process.exit(err.exitCode ?? ExitCode.InternalError)
    }
    throw err
  }
}

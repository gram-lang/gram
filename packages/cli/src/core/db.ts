import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parse } from 'yaml'
import { validateIngredientDatabase } from '@gram/analyzer'
import type { IngredientData } from '@gram/analyzer'
import type { GramConfig } from '../types'
import { GramConfigError } from '../errors'

export async function loadDb(
  config: GramConfig,
  overridePath?: string,
): Promise<Record<string, IngredientData> | null> {
  const dbPath = resolve(overridePath ?? config.database ?? '.gram/ingredients.yaml')

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

  // Support both formats: with or without top-level 'ingredients:' wrapper
  const ingredients = (raw as Record<string, unknown>)?.ingredients ?? raw

  try {
    return validateIngredientDatabase(ingredients)
  } catch (err) {
    throw new GramConfigError(
      `Invalid ingredient database at ${dbPath}: ${(err as Error).message}`,
    )
  }
}

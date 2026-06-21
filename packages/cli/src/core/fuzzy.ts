import type { IngredientData } from '@gram/analyzer'
import type { FuzzyMatch } from '../types'

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const la = a.length, lb = b.length
  if (la === 0) return lb
  if (lb === 0) return la

  let prev = Array.from({ length: lb + 1 }, (_, i) => i)
  for (let i = 1; i <= la; i++) {
    const curr = [i]
    for (let j = 1; j <= lb; j++) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1]!
          : 1 + Math.min(prev[j - 1]!, prev[j]!, curr[j - 1]!)
    }
    prev = curr
  }
  return prev[lb]!
}

export function similarity(a: string, b: string): number {
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(a, b) / maxLen
}

export function findSimilarInDb(
  newId: string,
  db: Record<string, IngredientData>,
  threshold = 0.80,
): FuzzyMatch | null {
  let best: FuzzyMatch | null = null
  for (const existingId of Object.keys(db)) {
    const score = similarity(newId, existingId)
    if (score >= threshold && score < 1 && score > (best?.score ?? 0)) {
      best = { newId, existingId, score }
    }
  }
  return best
}

import type { IngredientData } from '@gram-lang/analyzer'
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

/**
 * Find the best matching position of `name` inside `text` using a sliding
 * n-gram window over words. Returns start/end char offsets or null if no
 * match exceeds the threshold.
 */
export function matchInText(
  name: string,
  text: string,
  threshold = 0.72,
): { start: number; end: number } | null {
  if (!name || !text) return null

  const normName = name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  const normText = text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')

  // Build word-boundary positions from the original text
  const wordRe = /\S+/g
  const words: Array<{ word: string; start: number; end: number }> = []
  let m = wordRe.exec(normText)
  while (m !== null) {
    words.push({ word: m[0], start: m.index, end: m.index + m[0].length })
    m = wordRe.exec(normText)
  }

  if (words.length === 0) return null

  const nameWordCount = normName.split(/\s+/).length
  // Slide a window of nameWordCount ± 1 words
  const windowSizes = Array.from(
    new Set([nameWordCount - 1, nameWordCount, nameWordCount + 1].filter(n => n > 0)),
  )

  let bestScore = 0
  let bestMatch: { start: number; end: number } | null = null

  for (const size of windowSizes) {
    for (let i = 0; i <= words.length - size; i++) {
      const chunk = words.slice(i, i + size)
      const chunkText = chunk.map(w => w.word).join(' ')
      const score = similarity(normName, chunkText)
      if (score > bestScore) {
        bestScore = score
        bestMatch = { start: chunk[0]!.start, end: chunk[chunk.length - 1]!.end }
      }
    }
  }

  return bestScore >= threshold ? bestMatch : null
}

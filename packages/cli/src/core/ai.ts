import { GoogleGenerativeAI } from '@google/generative-ai'
import { GramCLIError, ExitCode } from '../errors'
import type { GramConfig } from '../types'

export const DEFAULT_AI_MODEL = 'gemini-2.0-flash'

export function loadAiClient(config: GramConfig): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY ?? config.ai?.apiKey
  if (!apiKey) {
    throw new GramCLIError(
      'Gemini API key required. Set GEMINI_API_KEY or run: gram config set ai.apiKey <key>',
      ExitCode.Error,
    )
  }
  return new GoogleGenerativeAI(apiKey)
}

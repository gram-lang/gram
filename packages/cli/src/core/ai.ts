import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'
import { GramCLIError, ExitCode } from '../errors'
import type { GramConfig } from '../types'

const DEFAULTS: Record<string, string> = {
  google: 'gemini-2.0-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5-20251001',
  ollama: 'llama3.2',
}

export function loadAiModel(config: GramConfig): LanguageModel {
  const ai = config.ai ?? {}

  // Determine provider: explicit config wins, then env-var detection
  const provider =
    ai.provider ??
    (process.env.GEMINI_API_KEY ? 'google' :
     process.env.OPENAI_API_KEY ? 'openai' :
     process.env.ANTHROPIC_API_KEY ? 'anthropic' :
     null)

  const model = ai.model ?? (provider ? DEFAULTS[provider] : undefined)

  if (!provider || !model) {
    throw new GramCLIError(
      'No AI provider configured. Set one of: GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or add "ai.provider" to your .gram/config.yaml.',
      ExitCode.Error,
    )
  }

  switch (provider) {
    case 'google': {
      const apiKey = process.env.GEMINI_API_KEY ?? ai.apiKey
      if (!apiKey) throw new GramCLIError('Missing GEMINI_API_KEY or ai.apiKey in config.', ExitCode.Error)
      return createGoogleGenerativeAI({ apiKey })(model)
    }

    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY ?? ai.apiKey
      if (!apiKey) throw new GramCLIError('Missing OPENAI_API_KEY or ai.apiKey in config.', ExitCode.Error)
      return createOpenAI({ apiKey })(model)
    }

    case 'anthropic': {
      const apiKey = process.env.ANTHROPIC_API_KEY ?? ai.apiKey
      if (!apiKey) throw new GramCLIError('Missing ANTHROPIC_API_KEY or ai.apiKey in config.', ExitCode.Error)
      return createAnthropic({ apiKey })(model)
    }

    case 'ollama': {
      const baseURL = ai.baseUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1'
      const ollama = createOpenAICompatible({ name: 'ollama', baseURL, apiKey: 'ollama' })
      return ollama(model)
    }

    default:
      throw new GramCLIError(
        `Unknown AI provider "${provider}". Supported: google, openai, anthropic, ollama.`,
        ExitCode.Error,
      )
  }
}

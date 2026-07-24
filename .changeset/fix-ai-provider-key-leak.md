---
"@gram-lang/cli": patch
---

Fixed a bug where the wrong API key could be sent to the wrong AI provider. If you had, say, `GEMINI_API_KEY` set in your environment but configured `provider: openai` in `.gram/config.yaml`, your Gemini key could be sent to OpenAI instead. Each provider now only ever uses its own key.

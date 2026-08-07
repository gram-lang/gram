---
"@gram-lang/cli": patch
---

Fixed `gram init`'s AI provider setup so the model choices it offers always match the CLI's actual recommended models — previously, the interactive Ollama setup only offered `llama3`, even though `llama4` was meant to be the recommended option.

---
"@gram-lang/cli": minor
---

You can now see and change the AI model on every command that uses AI.

`gram import`, `gram db lint` and `gram db enrich` used to call whatever model your config happened to point at, without ever saying which one. Now they print it before starting — provider, model, and where the choice came from — and let you change it for a single run:

```bash
gram import recipe.json --model gemini-3.1-pro   # a better model, just this once
gram db enrich --provider anthropic              # a different provider, just this once
gram db lint --pick-model                        # pick from a menu
```

None of these write to your config, so your usual setup stays untouched. To change it for good, keep using `gram config set` or `gram init`.

Two other things changed along the way:

**Your API key can no longer end up at the wrong provider.** Settings written under `ai:` — the key, the model name, the base URL — belong to the provider they were written for. If a run ends up on a different provider, whether through `--provider` or through a project config that overrides a global one, those settings are now left behind and Gram asks for the right provider's key instead. Previously a global config saying "use Google with this key" could quietly hand that key to OpenAI when a project asked for OpenAI.

**`gram import` no longer hangs in scripts.** Run with `--output` but without `--yes` in a non-interactive context, it used to display the review prompt and then wait forever for an answer nobody could give. It now warns that the review was skipped and writes the file.

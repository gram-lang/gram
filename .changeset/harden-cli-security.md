---
"@gram-lang/cli": patch
---

`.env` is now written with `0600` permissions instead of the OS default, so API
keys are no longer group/world-readable on shared machines. `.gram/config.yaml`
is now validated at load time (invalid fields fail with a clear error instead of
crashing deep in the pipeline). `gram import` now times out after 15s, caps
response bodies at 10MB, and asks for confirmation before writing AI-converted
content from an untrusted external source to disk (skippable with `--yes`).

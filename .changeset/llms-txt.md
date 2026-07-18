---
"@gram-lang/docs": minor
---

feat: publish `llms.txt` and `llms-full.txt` for AI/agent consumption

- Added `packages/docs/src/public/llms.txt`, a curated index of the documentation site (per the llms.txt convention) with short descriptions and links to every key page.
- Added `packages/docs/scripts/generate-llms-full.ts`, generating `packages/docs/src/public/llms-full.txt` — the full language spec (philosophy, document structure, all syntax reference pages, cheatsheet, data formats, and warnings) concatenated into a single file for LLMs/agents that fetch content without browsing.
- Added a new reference page, "Writing Gram Programmatically" (`reference/syntax/ai-generation-notes`, with a French translation), documenting the common mistakes made when generating `.gram` files programmatically — extracted from the CLI's AI import prompt and now a citable, human-readable doc page.

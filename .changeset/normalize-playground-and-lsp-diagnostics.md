---
"@gram-lang/i18n": patch
"@gram-lang/language-server": patch
---

**Language Server & Tooling**: Normalized error states and unified diagnostic handling across Playground and VSCode extensions:
  - Unified Playground diagnostics into a centralized model with interactive jump-to-location navigation and graceful error states across all preview views.
  - Resolved silent compilation failures in the Language Server by capturing pipeline exceptions and pushing actionable error notifications to webviews.
  - Added bidirectional webview messaging in the VSCode extension to jump directly to error offsets in the active editor.

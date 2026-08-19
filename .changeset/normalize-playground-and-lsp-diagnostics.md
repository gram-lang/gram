---
"@gram-lang/analyzer": patch
"@gram-lang/renderer": patch
"@gram-lang/i18n": patch
"@gram-lang/language-server": patch
---

**Language Server & Tooling**: Normalized error states and unified diagnostic handling across Playground and VSCode extensions:
  - Unified Playground diagnostics into a centralized full-width debug console with filter pills and interactive jump-to-location navigation.
  - Added mobile segmented tab navigation (`[Editor]` / `[Preview]`) and responsive single-row toolbar layout for mobile viewports.
  - Resolved nutrition diagnostics disconnection in the analyzer by merging physical and nutritional warnings into primary compiler warnings.
  - Cleaned up rendered document outputs (HTML and Markdown) by removing inlined warning disclaimers in favor of centralized diagnostics.
  - Resolved silent compilation failures in the Language Server by capturing pipeline exceptions and pushing actionable error notifications to webviews.
  - Added bidirectional webview messaging in the VSCode extension to jump directly to error offsets in the active editor.

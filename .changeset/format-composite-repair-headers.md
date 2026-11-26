---
"@gram-lang/format": patch
---

**Format**: Gluing a spaced composite (`@a{1} < @b{2}` → `@a{1}<@b{2}`) no longer touches section headers, whose title is text kept as written. `## Zest <@lemon ~{-1 h}` lost the blank in its title, and `## <@s` reported two changes on every pass while its text never changed, so `gram format --check` kept failing on it.

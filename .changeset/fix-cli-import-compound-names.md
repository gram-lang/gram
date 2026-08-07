---
"@gram-lang/cli": patch
---

Fixed `gram import` producing unwieldy ingredient names like `@boneless skinless chicken breast` instead of the more natural `@chicken breast(boneless, skinless)`. The AI already knew to move a preparation like "pounded to an even thickness" into a `(...)` annotation, but not qualifiers that happen to be grammatically fused into the ingredient name in the source recipe's language — the prompt now calls this out explicitly, which keeps names short and natural across languages.

---
"@gram-lang/kitchen": minor
"@gram-lang/renderer": minor
"@gram-lang/docs": minor
---

**Kitchen & Renderer**: The frontmatter keys Gram knows now come from one registry, and the keys that only ever worked in one view are deprecated:
  - Kitchen exports `FRONTMATTER_KEYS`, the frontmatter keys Gram gives a meaning to (functional or informational, the kind of value, an example line), which the docs and the HTML recipe now read; `language` (a BCP 47 tag) is documented among them.
  - A deprecated key raises the new `DEPRECATED_FRONTMATTER_KEY` warning, with the key to write instead; as a warning, it fails `gram check --strict`.
  - The HTML recipe shows `lastUpdated` in its byline as "Updated …" (in French, "Mis à jour le …") instead of a raw `lastUpdated:` entry.

**Deprecated**
  - Kitchen and Renderer: the frontmatter keys `servings`, `yield` and `yields`, removed in 2.0.0. Only the HTML recipe read them, and scaling and nutrition ignored them: write `portions` instead of `servings`, and `makes` instead of `yield` or `yields`.

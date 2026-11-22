---
"@gram-lang/cli": patch
---

**CLI**: `gram import` now says which step of an import failed instead of a bare "Import failed.":
  - Errors name the stage: reading the source, finding a recipe in it, or calling the AI model, and keep the provider's own reason for a failed model call.
  - A web page without a schema.org/Recipe block lists what its structured data describes instead, and makes clear that no AI model was called, so switching models is not the fix.
  - A recipe whose `@type` is a list (`["Recipe", "NewsArticle"]`) is now found.
  - An empty model answer is reported as such, rather than as a list of .gram validation errors.

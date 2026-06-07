---
"@gram/compiler": minor
---

Ingredient references without quantities (`@&ingredient{}`) are now excluded from section ingredients summaries. This keeps section-level mise en place lists clean by filtering out pure flow instructions (like removing or re-inserting) while preserving separate measured portions.

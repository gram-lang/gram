---
"@gram-lang/cli": patch
---

Reduced the size and noise of what `gram import` sends to the AI. It used to forward the entire raw JSON-LD recipe object, which on real-world sites often carries fields that have nothing to do with writing a recipe — image URLs, ratings, full-text reviews, video metadata — and can dwarf the actual recipe content in size. It now sends a minimal, pre-cleaned payload (title, description, author, category, tags, timings, ingredients, and instructions, stripped of stray HTML markup and entities), which lowers token cost and stops the model from getting distracted by irrelevant data.

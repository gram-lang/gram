# Cheatsheet

A quick reference guide to the Gram syntax.

## Basic Elements

| Element | Syntax | Example | Description |
|---|---|---|---|
| **Ingredient** | `@name{qty}` | `@flour{200g}` | Adds an ingredient to the shopping list. |
| **Cookware** | `#name{qty}` | `#pan{}` | Requires specific equipment. |
| **Timer** | `~{time}` | `~{30min}` | An active duration. |
| **Temperature** | `°{temp}` | `°{180°C}` | An exact temperature. |

## Modifiers

Modifiers are placed immediately after the `@` or `#` symbol.

| Modifier | Example | Effect |
|---|---|---|
| `&` (Reference) | `@&flour` | References a previously declared item. Does NOT add it to the shopping list again. |
| `=` (Fixed) | `@=salt{1 tsp}` | Marks the quantity as fixed. It will **not** scale with portions. |
| `?` (Optional) | `@?thyme` | Marks the item as optional. |
| `-` (Hidden) | `@-sugar` | Hides the item from the generated shopping list. |

## Advanced Syntax

| Feature | Syntax | Example |
|---|---|---|
| **Range** | `qty-qty` | `@eggs{2-4}` |
| **Alternatives** | `\|` | `@milk{100ml}\|@water{95ml}` |
| **Short-hand Prep** | `(...)` | `@butter{10g}(room temp)` |
| **Alias (Rename)** | `:display` | `@dry white wine:wine{10ml}` |
| **Relative Qty** | `% @&target` | `@water{70% @&flour}` |
| **Passive Timer** | `~&` | `~&{1h}` |
| **Named Timer** | `~name{...}`| `~eggs{3min}` |
| **Semantic Temp**| `°{text}` | `°{medium heat}` |

## Intermediate Variables

Used to declare sub-components (like a dough or sauce) that are referenced later.

| Location | Syntax | Example | Scope |
|---|---|---|---|
| **End of a Step** | `->&name` | `Mix until smooth. ->&dough` | Captures only that step. |
| **End of a Section**| `->&name` | `## Puff Pastry ->&pastry` | Captures the entire section. |

## Section Scheduling (Retro-planning)

Placed anywhere in a section title to indicate preparation timeframe.

| Syntax | Example | Meaning |
|---|---|---|
| `~{-time}` | `## Dough ~{-2d}` | Prepare 2 days in advance. |

## Composite Ingredients

Extracting child components from a shared parent ingredient.

| Syntax | Example | Behavior |
|---|---|---|
| `<@parent` | `@zest{1}<@lemon` | Groups zest and juice under the same lemon in the shopping list. |

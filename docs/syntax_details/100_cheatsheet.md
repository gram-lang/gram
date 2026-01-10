# GRAM Syntax Cheatsheet

### 1. Basic Ingredients
* **Simple**: `Add the @butter{}.`
* **Quantity**: `Add @butter{100}.`
* **Unit**: `Add @butter{100g}.`
* **Compound Name**: `Add @sea salt{}.` (Braces always mandatory).
* **Notes (Prep)**: `@onion{}(chopped)` or `@garlic{1}(crushed)`.

### 2. Modifiers (Flags)
Placed right after the `@`.
* `@?` **Optional**: `@?sugar{}` (Displays "optional").
* `@-` **Hidden**: `@-salt{}` (Does not show in shopping list, useful for "Salt, pepper").
* `@*` **Baker's Base**: `@*flour{}` (100% reference for baker's math).
* `@&` **Reference**: `@&butter{50g}` (Reuses previously listed butter, adds 50g to total).
    *   *Safety*: Triggers error if `butter` was not defined before (typo check).
    *   *Instruction*: `@&butter{}` (No qty) = "Use the prepared butter" (Does NOT add to shopping list).

### 3. Advanced Management
* **Aliases** (Rename): `@white wine[wine]{}` -> Displays "wine", lists "white wine".
* **Alternatives** (Choice): `@milk{}|@water{}` or `#pan{}|#wok{}`.
* **Composites** (Sub-parts):
    * Source: `@zest{}<@lemon{}` (Cost: 1), `@juice{2}<@lemon{}` (Cost: 2).
    * Rules: `Total = Max(@parent)`. Defaults to parent qty=1 if omitted. Merges with direct usage (`@lemon{2}`).
* **Relative Quantities**: `Add @water{60% @flour}` (Calculates 60% of the sum of previous flours in the section).

### 4. Recipe Structure
* **Sections**: `## Section Title`
* **Steps**: Paragraphs separated by an empty line.
* **Action**: `[Verb]` at start of step (ex: `[Mix]...`).
* **Comments**: `// comment` (end of line) or `/* block */`.

### 5. Other Elements & Metadata
*   **Cookware**: `#bowl{}` (Fixed), `#ramekins{4}` (Scalable), `#pan{=1}` (Forced Fixed).
    * *Dimensions/Material*: ALWAYS in `()` AFTER. `#mold{}(20cm)` (NOT `#mold{20cm}`).
* **Timers**: 
    * `~{20min}` (Blocking/Active).
    * `~{1h}&` (Async/Background - e.g. baking, resting).
    * Range: `~{20-30min}`.
* **Metrics**: The compiler automatically calculates **Active Work**, **Total Duration**, and **Estimated Prep Time** (Mise en place).
* **Temperatures**: `!{180°C}` (Unit mandatory: °C, °F).
    * Range: `!{180-200°C}`.
* **Intermediate Preparations**:
    * *Definition*: At end of paragraph `->&dough{}` or title `## Title ->&dough{}`.
    * *Usage*: `Let the &dough{} rest.` or `Use &dough{100g}.` (No `@`, not in shopping list).
* **Retro-planning**:
    * *Definition*: At end of title only `## Title {T-2d}`.
    * *Usage*: Supports only `d` (days), `h` (hours) or `m` / `min` (minutes).
* **Metadata (Frontmatter)**:
  ```yaml
  densities:
    - flour: 0.55 # g/ml
  portions: 4 servings
  ```
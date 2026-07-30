---
title: "Writing Gram Programmatically"
---

This page is for anything that *generates* `.gram` files rather than a person typing them by hand — an import script, a scraper, or an AI model converting an existing recipe (a website, a cookbook scan, a JSON-LD blob) into Gram. The official `gram import` command feeds the AI model it calls a system prompt (`packages/cli/src/prompts/gram-spec.ts`) that's kept manually in sync with this guidance, so treat this page as the published, human-readable version of that same knowledge.

## Restructure, don't transliterate

Traditional recipe text contains many steps that only exist because prose has no other way to express them. In Gram, most of these dissolve into the syntax itself instead of staying separate steps:

- "Cut the lemon in half" → just `@lemon{1}(cut in half)` on the ingredient that uses it.
- "Reserve the seasoning" → just `&seasoning` when it's referenced later.
- "Set aside and let cool" → just `~_{30min}` at the end of the step that produces it.

A well-generated `.gram` file often has **fewer steps** than its source, different section boundaries, and a different logical flow — a 10-step source recipe might reasonably compile down to 5 Gram steps. Preserving the original step count is not a goal; clarity is. For every source step, the question worth asking is: does this step do real cooking work, or does it only exist to set up information that Gram can express inline? If it's the latter, absorb it into the ingredient or timer that uses it instead of keeping it as its own step.

## A conversion checklist

When turning an existing recipe into `.gram`, working through these five points in order catches most structural mistakes before they happen:

1. **Structure** — Identify distinct phases (dough, filling, sauce, assembly…). Each phase with its own ingredient list is a candidate for a `## Section`. Anything that must be prepared in advance gets a retro-planning lead time (see [Document Structure](./document-structure.md#retro-planning-scheduling)).
2. **Frontmatter** — Extract `title`, `author`, `source`, `category`, `portions`, and dates from whatever metadata the source provides. Never invent a value that isn't in the source.
3. **Ingredients** — List every unique `@ingredient` using its full name with spaces (`"olive oil"`, not `"olive-oil"`). Note which ones appear more than once — the second and later mentions should use `@&`. Prefer SI units for precision, but keep `tbsp`/`tsp`/`cup` for small amounts when that's how the source expresses them. For parts of an ingredient (juice, zest, yolk…), plan the [composite syntax](./composite-ingredients.md) instead of a separate prep step.
4. **Steps** — Write each step as a paragraph with a `[Verb]` action prefix, inlining every `@ingredient`, `#cookware`, `~timer`, and `^temperature` as it's introduced. Use passive timers (`~_`) for hands-off waits (oven, resting, chilling, rising) and active timers (`~`) for anything that keeps the cook busy. If multiple passive timers must happen sequentially (one after another, e.g. baking in stages), give them the SAME NAME (`~_baking{10m}` then `~_baking{30m}`) to automatically sequence them without adding to the cook's active time.
5. **Review** — Before finalizing, check for the mistakes listed below: kebab-case names, units inside cookware braces, missing `@&` on repeat mentions, redundant `->&name` declarations, and standalone steps that only prepare an ingredient for a later step.

## Common mistakes

These are the errors that show up most often in programmatically generated `.gram` files.

### Kebab-case ingredient names

```gram
❌  @olive-oil{2 tbsp}         →   ✅  @olive oil{2 tbsp}
❌  @all-purpose-flour{250g}   →   ✅  @all purpose flour{250g}
```
Gram ingredient names are real words with spaces, not slugs. Kebab-case is an internal, database-level concept — never syntax.

### Multi-word names without `{}`

```gram
❌  Add @egg substitute and mix well.
✅  Add @egg substitute{} and mix well.

❌  X @egg substitute|@tofu and stir.
✅  X @egg substitute{}|@tofu{} and stir.
```
A multi-word `@ingredient`/`#cookware` name always needs `{}` (or `{count}` for cookware) as its closing delimiter — even when the exact quantity is unknown, use empty braces `{}`. There is no bare (no-`{}`) form for a multi-word name; the bare form only works for a single word (`@salt`, `#pan`). Without `{}`, only the first word becomes the name and everything after it silently becomes ordinary step text — inside an alternative (`|`) this now throws a hard parse error instead of silently corrupting the group.

### Units inside cookware braces

```gram
❌  #pan{20cm}      →   ✅  #pan(20cm)
❌  #bowl{large}    →   ✅  #bowl(large)
```
`#cookware` braces accept integer counts only. Dimensions, materials, and descriptions always go in parentheses — see [Cookware](./cookware.md).

### Free text where a number is required

```gram
❌  @salt{to taste}        →   ✅  @salt{}   or   @salt
❌  @flour{about 200g}     →   ✅  @flour{200g}
❌  ~{about 10 minutes}    →   ✅  ~{10min}
```
Quantities and timers need a real number (or empty braces for "to taste"); fuzzy text doesn't parse.

### Using `@&` on the first occurrence

```gram
❌  @&butter{200g}   (first time butter appears)
✅  @butter{200g}    (first declaration)
✅  @&butter{50g}    (second use, in a later step)
```

### Confusing `@&` (raw ingredient) with `&` (intermediate)

```gram
// chicken was declared as @chicken{4}, NOT as an intermediate
❌  Brown the &chicken for ~{3min}.     // & implies an intermediate that doesn't exist
✅  Brown the @&chicken for ~{3min}.    // @& = second reference to a raw ingredient

// dough was produced by a step ending with ->&dough
❌  Roll out the @&dough.              // @& implies a shopping-list ingredient
✅  Roll out the &dough.               // & = reference to the declared intermediate
```
See [Intermediate Variables](./intermediate-variables.md) for the full distinction. More generally, whenever a step transforms an ingredient into a new product referenced by name in later steps ("the seasoned chicken", "the dough"), declaring it with `->&name` avoids this ambiguity entirely.

### Standalone steps that only prepare an ingredient

```gram
❌  [Prep] Cut @lemon{1} in half. Thinly slice one half for garnish.
    [Cook] Squeeze juice from @lemon{1/2} into the pan.

✅  [Cook] Squeeze @juice<@lemon{1}(cut in half, one half sliced for garnish) into the pan.
```
Any step whose entire purpose is "take X and do Y to it before the real step" should collapse into the ingredient reference of the step that actually uses it, using the `()` preparation shorthand — here it attaches to the composite's parent (`<@lemon{1}(...)`), since "cut in half" describes the lemon, not the juice.

### "The juice/zest/part of" phrasing instead of composite syntax

```gram
❌  the juice from @lemon{1/2}    →   ✅  @juice<@lemon{1/2}
❌  the zest of @lemon{2}         →   ✅  @zest{1}<@lemon{2}
```
[Composite ingredients](./composite-ingredients.md) keep the shopping list accurate (the overlap rule: zest + juice from the same lemon still aggregates to one lemon) and remove the need for a standalone prep step.

### Spaces around the composite operator

```gram
❌  @zest{1} < @lemon{2}
❌  @zest{1} <@lemon{2}
✅  @zest{1}<@lemon{2}
```

### Attaching a composite's preparation to the wrong side

```gram
❌  @juice(cut in half, one half sliced for garnish)<@lemon{1}    // says the JUICE was cut in half
✅  @juice<@lemon{1}(cut in half, one half sliced for garnish)    // says the LEMON was cut in half
```
Both the child and the parent of a composite can carry their own independent `()` preparation:
- **Child's preparation** goes right after its own name (and quantity, if any).
- **Parent's preparation** goes right after `<@parentName{parentCost}`.

Attach it to whichever one it actually describes — "cut in half" happens to the whole lemon, not to the extracted juice. They can also combine when both genuinely need one: `@juice{150ml}(strained)<@lemon{1}(cut in half)`.

### A redundant `->&name` when the section title already declares one

```gram
❌ ## Seasoning Mix ->&seasoning

   [Mix] @paprika{2 tsp} with @salt{1 tsp}. ->&mix1   // WRONG: the section already declares the output

✅ ## Seasoning Mix ->&seasoning

   [Mix] @paprika{2 tsp} with @salt{1 tsp}.            // no local declaration needed
```
A section-level `->&name` already captures the output of every step inside it — see [Intermediate Variables](./intermediate-variables.md#section-level-declaration).

### An active timer for passive cooking

```gram
❌  Bake for ~{45min}.        // implies the cook is actively busy for 45 minutes
✅  Bake for ~_{45min}.       // the oven does the work, the cook is free
✅  Knead for ~{10min}.       // the cook IS actively busy — an active timer is correct here
```

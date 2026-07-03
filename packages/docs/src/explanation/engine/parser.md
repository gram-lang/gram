# Parsing & AST

The `@gram/parser` package is the foundation of the Gram ecosystem. Its sole responsibility is to read raw `.gram` text and convert it into an Abstract Syntax Tree (AST).

## OhmJS

Gram's syntax rules are defined using [OhmJS](https://ohmjs.org/), an object-oriented parsing toolkit built around Parsing Expression Grammars (PEGs).

Ohm makes it extremely easy to build modular grammars. Because of this, `@gram/parser` is incredibly fast and strictly enforces the structural rules of the language — for example, a space is forbidden immediately around the composite marker `<@` itself (`invalidComposite` in the grammar), so `pastry < @dough` fails to parse while `<@dough` succeeds.

## The Abstract Syntax Tree (AST)

If the parser succeeds, it outputs an AST. This is a tree of JavaScript objects representing every semantic token in the recipe.

For example, this simple step:
```gram
Add the @flour{200g}.
```

Is parsed into a `Step` node containing a `Text` node ("Add the "), an `Ingredient` node, and a trailing `Text` node ("."):
```json
{
  "type": "Ingredient",
  "name": "flour",
  "quantity": {
    "type": "Quantity",
    "value": { "type": "single", "value": 200, "text": "200" },
    "unit": "g",
    "fixed": false
  },
  "modifiers": [],
  "alias": null,
  "preparation": null,
  "composite": null
}
```

Note that `quantity.value` is always a `QuantityValueAST` object, never a bare number — this is what allows the parser to also represent fractions (`1/2`) and ranges (`2-3`) without losing the original text representation.

### Supported AST Nodes

The parser exposes specific node types for everything in the Gram language (`ASTNodeType` in `src/types.ts`):
- `Recipe`: The root node containing the frontmatter (`meta`) and a list of `Section` nodes.
- `Section`: A group of `Step` and top-level `Comment` nodes. A section can also carry an optional retro-planning header (`~{...}`) and an intermediate declaration.
- `Step`: A single paragraph containing `Text`, `Ingredient`, `Cookware`, `Timer`, `Temperature`, `Reference`, `Alternative`, `IntermediateDecl`, and `Comment` nodes. A step can also carry an optional leading bracketed `action` tag (e.g. `[Preheat]`).
- `Ingredient` / `Cookware`: Can themselves be wrapped in an `Alternative` node when written with the `|` operator (e.g. `@butter|@margarine`).
- `Quantity`, `RelativeQuantity`, `TextQuantity`: The three possible shapes a quantity can take — a numeric/fraction/range value with a unit, a percentage relative to another ingredient (`50%@flour`), or free-form text that couldn't be parsed as a number.
- `Composite`: Represents a composite ingredient reference (`<@lemon`), used to aggregate parts (zest, juice) back into a whole item.
- `Comment`: A `//` line comment or `/* */` block comment.

::: tip Modifiers are raw symbols
The `modifiers` array on `Ingredient`/`Cookware` nodes holds the raw punctuation characters as written in the source (`?`, `-`, `*`, `&`), not semantic labels. `=` is handled separately: it doesn't appear in `modifiers` at all, it instead sets `quantity.fixed` to `true`.
:::

## Purely Syntactic

`@gram/parser` performs no domain or semantic reasoning. It has no knowledge of:
- Whether a referenced variable `&dough` was actually declared earlier.
- Whether `200g` of `flour` needs to be scaled or converted.
- Whether `flour` exists in your `ingredients.yaml` database.

It does, however, perform a small amount of local, non-semantic work while building the tree: it validates the recipe frontmatter against a schema (silently discarding it if invalid), averages the two bounds of a range (`2-3` → tracked with an average of `2.5`) for convenience, and raises a friendly syntax error when it detects a malformed composite reference. None of this requires knowledge of the rest of the recipe — the parser still hands off a purely structural tree to `@gram/kitchen`, which is where actual reference resolution and validation happen.

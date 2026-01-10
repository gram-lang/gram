# Advanced Features

For complex cases where a linear ingredient list is not enough.

## 1. Composite Ingredients

Moved to [08_composite_ingredients.md](./08_composite_ingredients.md).

Allows stating that an ingredient (Child) is drawn from another (Parent).
Ex: `@zest{1}<@lemon{1}`

## 2. Alternatives (Or)

To offer a choice to the user.

### Syntax `|`
Separate two (or more) elements with a vertical bar.

```gram
@butter{100g}|@margarine{100g}
```

*   **Shopping List**: Both appear grouped under an "Alternative" type. The UI will often show the first one by default, with an option to swap.
*   **Works for everything**: Ingredients, Cookware.
    *   `#wok{}|#pan{}`

## 3. Inline Preps (chopped, sliced...)

To avoid overloading ingredient names.
Use parentheses `()` right next to the brace `{}`.

```gram
@onion{1}(diced)
```

This text is attached to the ingredient but separated from the name.
*   Shopping: "Onion"
*   Instruction: "Onion (diced)"

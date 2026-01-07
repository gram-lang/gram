# Advanced Features

For complex cases where a linear ingredient list is not enough.

## 1. Composite Ingredients (Passenger/Driver)

Useful when an ingredient is "split" or "transformed" into multiple sub-parts (e.g., Egg -> White + Yolk).

### Syntax `Child < Parent`
Use `<` to say "This comes from...".

*   The **Child** (@zest{}) is what is used in the step.
*   The **Parent** (@lemon{}) is the item to buy.

```gram
Add the @zest{1}<@lemon{1}.

Later, squeeze the @juice{3}<@lemon{3}.
```

### MAX Rule (Driver)
How to know how many lemons to buy?
GRAM looks at all "requests" made to the parent and takes the largest one (the MAX).

*   Step 1: Need 1 zest (requires 1 lemon).
*   Step 2: Need 3 juices (requires 3 lemons).
*   **Total Shopping**: 3 Lemons. (We will have 2 extra/wasted zests, but we must buy 3 lemons).

If you put an explicit quantity on both child AND parent:
`@zest{1}<@lemon{2}` -> "I need one zest, but consume 2 lemons to get it".

Works with volumes or mass too:
`@juice{75ml}<@lemon{2}` -> "I need 15ml of juice, it consumes 2 lemons to get it".

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

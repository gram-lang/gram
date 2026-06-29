# Cookware (#)

Cookware defines the necessary equipment. GRAM intelligently manages their scalability.

## Basic Syntax

`#name{qty}` or `#name`

*   `#`: Trigger.
*   `name`: Name of the tool.
*   `{qty}`: **INTEGER ONLY**. Number of items required. (Optional)

**Warning:** Braces `{}` are STRICTLY reserved for **quantity (count)**. They can be completely omitted if no quantity is specified for a single-word tool.
*   ✅Correct: `#mold{1}` or `#mold`
*   ❌Wrong: `#mold{20cm}` (20cm is not a quantity)

## Dimensions and Materials

To specify size or material, use **parentheses** `()` right after the braces (or right after the name if braces are omitted).

```gram
#mold(20cm, removable bottom)
#loaf pan{2}(stainless steel)
```

## Scalability Rules

This is a key feature of cookware in GRAM. The system guesses if the tool should be multiplied when doubling the recipe.

| Syntax | Type | Logic | Example |
| :--- | :--- | :--- | :--- |
| `#bowl` | **FIXED (Implicit)** | No quantity = We assume one is needed, regardless of recipe size. | `#knife`. If I make 100 pies, I still need only one knife. |
| `#ramekins{4}` | **SCALABLE** | Numbered quantity = We assume it's linked to servings. | `#ramekins{4}`. If I double the recipe, I need 8. |
| `#=pan{2}` | **FIXED (Explicit)** | The `=` modifier forces fixed mode. | `#=pan{2}`. I use 2 pans to cook crepes faster, even if I make 1000 crepes, I only have 2 pans. |

> **Tip:** This logic allows the recipe to scale intelligently: you'll always have enough *service* items (ramekins, plates) without erroneously multiplying *equipment* (ovens, mixers).

## Best Practices

1.  **Distinguish container from tool.**
    *   `#bowl` (Container)
    *   `#whisk` (Tool)
    Both are generally "Fixed".
2.  **Think about service.**
    *   `#glasses{6}` (Service) -> Scalable.
3.  **Modifiers.**
    You can use `?` (Optional) or `-` (Hidden) like for ingredients.
    *   `Place in the #?dishwasher.`

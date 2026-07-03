# How to Generate a Weekly Shopping List

If you use Gram for meal prepping or batch cooking, you likely have multiple `.gram` files scattered in a directory. 

Generating a single, consolidated shopping list across multiple recipes is one of Gram's most powerful features. The `@gram/kitchen` compiler aggregates ingredients intelligently, fusing quantities when possible.

## The `gram shop` Command

Use the CLI `gram shop` command and pass a glob pattern targeting your recipes.

```bash
# Target a specific folder
gram shop "menus/week-1/*.gram"
```

### What happens during aggregation?

1. **ID Matching**: The compiler groups all ingredients that share the same base ID (e.g., all instances of `@butter`).
2. **Alias Resolution**: If your database defines `unsalted butter` as an alias for `butter`, Gram will seamlessly merge `@unsalted butter{50g}` and `@butter{50g}` into a single `100g` entry under the primary key `butter`.
3. **Unit Normalization**: If one recipe uses `@milk{200ml}` and another uses `@milk{1 cup}`, the analyzer uses the database to normalize them (usually into grams, or whichever display unit you configured).
4. **Categorization**: The final list is sorted by culinary categories (e.g., *Dairy*, *Produce*, *Pantry*) based on your `ingredients.yaml` data, making it easy to navigate a supermarket.

## Batch Scaling

You can scale your entire meal plan at once. If your recipes are written for 2 portions, but you have 4 guests this week, you can pass a global scale multiplier:

```bash
gram shop "menus/week-1/*.gram" --scale 2
```

> **Note**: When scaling multiple files at once, you must use a numeric multiplier (`--scale 2`). You cannot scale by a specific ingredient reference (`--scale flour=500g`), as the compiler wouldn't know *which* recipe's flour to target.

## Output Formats

By default, `gram shop` outputs a beautifully formatted ASCII list directly in your terminal. 

However, you can export it to different formats to share it with your family or integrate it with other tools:

```bash
# Export to Markdown
gram shop "menus/*.gram" --format md --output shopping-list.md

# Export to JSON
gram shop "menus/*.gram" --format json --output shopping-list.json
```

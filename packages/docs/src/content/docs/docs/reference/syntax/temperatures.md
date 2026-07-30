---
title: "Temperatures"
---

You can define `^temperature` declarations in your recipes using the `^` symbol.

Gram supports two formats for a `^temperature` to accommodate both precise baking requirements and subjective stovetop cooking instructions: **Exact Temperatures** and **Semantic Temperatures**.

## Exact Temperatures

Exact temperatures must specify a numeric value and a valid unit: `C` or `F`, case-insensitive, with or without the leading degree sign (`°C`/`°F`). Whatever spelling you use, the compiler normalizes it to the canonical `°C`/`°F` form in its output.

```gram
Preheat the #oven to ^{180C}.

Bake at ^{350°F} until golden brown.
```

### Temperature Names
Just like a `~timer`, you can assign a specific name to a `^temperature`. This is especially useful for clarity, allowing tools (like the CLI) or custom UI renderers to quickly extract and highlight key step information at a glance (e.g. which appliance needs to be set).

```gram
Preheat the #oven to ^oven{180°C}.
```

## Semantic Temperatures

For stovetop cooking or subjective instructions where an exact degree measurement doesn't make sense, you can use semantic `^temperature` strings. This allows you to write generic free-text strings.

```gram
Cook on ^stove{high heat} for ~{2 min}.

Turn down to ^{low} and let simmer.
```

:::note[Parsing Rules]
When the Gram compiler encounters a `^temperature`, it checks if the content inside the braces starts with a number.
- If it does, it parses it as an Exact Temperature and validates the unit that follows.
- If it doesn't, it treats the entire content as a Semantic text string.
:::

## Error Handling

Only Celsius and Fahrenheit are supported — no Kelvin or other scales. The compiler validates `^temperature` declarations and will output specific warnings for malformed exact temperatures:

- **Missing Unit**: If you write `^{200}` without specifying `C` or `F`, the compiler warns `MISSING_UNIT`.
- **Invalid Unit**: If you provide a numeric value with an unrecognized unit (e.g., `^{200K}`), the compiler warns `INVALID_UNIT` and keeps the raw value as written.

# Temperatures

You can define temperatures in your recipes using the `°` symbol. 

Gram supports two formats for temperatures to accommodate both precise baking requirements and subjective stovetop cooking instructions: **Exact Temperatures** and **Semantic Temperatures**.

## Exact Temperatures

Exact temperatures must specify a numeric value and a valid unit (`°C` or `°F`).

```gram
Preheat the #oven to °{180°C}.
Bake at °{350°F} until golden brown.
```

### Temperature Names
Just like timers, you can give a specific name to a temperature. This is useful for clarity or for external applications (like smart ovens) to identify which appliance needs to be set.

```gram
Preheat the #oven to °oven{180°C}.
```

## Semantic Temperatures

For stovetop cooking or subjective instructions where an exact degree measurement doesn't make sense, you can use semantic temperatures. This allows you to write generic free-text strings.

```gram
Cook on °stove{high heat} for 2 minutes.
Turn down to °{low} and let simmer.
```

::: info Parsing Rules
When the Gram compiler encounters a temperature, it checks if the content inside the braces contains a recognized unit (`°C` or `°F`). 
- If it does, it parses it as an Exact Temperature (validating the number).
- If it doesn't, it treats the entire content as a Semantic text string.
:::

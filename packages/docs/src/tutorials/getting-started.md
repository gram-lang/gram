# Getting Started

This guide will help you install the Gram ecosystem and compile your first recipe.

## 1. Installation

Gram is distributed as a set of NPM packages. To start using it, you need to install the Gram CLI globally or locally in your project.

::: code-group

```bash [npm]
npm install -g @gram/cli
```

```bash [pnpm]
pnpm add -g @gram/cli
```

```bash [bun]
bun add -g @gram/cli
```

:::

## 2. Editor Setup

Because Gram treats recipes as code, having the right editor makes a huge difference.

We highly recommend installing the **Gram VS Code Extension**. It provides:
- Syntax highlighting
- Auto-completion
- Inline diagnostics and error checking
- Real-time compiler feedback

[View on VS Code Marketplace](https://marketplace.visualstudio.com/) *(Coming soon)*

## 3. Writing Your First Recipe

Create a new file named `pancakes.gram`.

Open it in your editor and add the following basic recipe:

```gram [pancakes.gram]
---
title: Pancakes
portions: 2
---
## Batter ->&batter

Mix @flour{100g}, @milk{150ml}, and @eggs{2}.
Add a pinch of @=salt.

## Cooking

Melt @butter{10g} in a #pan(large).
Pour the &batter and cook for ~{2min} on °stove{medium heat}.
```

## 4. Compiling the Recipe

Now, let's use the CLI to compile your recipe into a structured JSON format.

Run the following command in your terminal:

```bash
gram build pancakes.gram
```

This will parse the recipe, run the mass normalization and nutritional analysis algorithms, and output the result. By default, it prints to the console, but you can save it to a file:

```bash
gram build pancakes.gram -o pancakes.json
```

::: tip Try the playground
If you don't want to install anything yet, you can try writing Gram directly in our web-based [Playground](../playground/index.md).
:::

## Next Steps

Now that you have written your first recipe, it's time to dive deeper into the syntax:
- Learn about [Document Structure](../syntax/document-structure.md)
- Learn how to declare [Ingredients](../syntax/ingredients.md)

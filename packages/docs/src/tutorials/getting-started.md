# Getting Started

This guide will help you install the Gram ecosystem and compile your first recipe.

## 1. Installation

Gram is optimized for [Bun](https://bun.sh/) and distributed as an NPM package. To start using it, you need to install the Gram CLI globally.

```bash
bun add -g @gram/cli
```
> [!NOTE]
> While it is technically possible to run Gram using Node.js and `npm` or `pnpm`, we highly recommend using Bun for optimal performance and compatibility.

## 2. Editor Setup

Because Gram treats recipes as code, having the right editor makes a huge difference.

We highly recommend installing the **Gram VS Code Extension**. It provides:
- Syntax highlighting
- Auto-completion
- Inline diagnostics and error checking
- Real-time compiler feedback

Currently, the extension is not available on the VS Code Marketplace, but you can build and install it locally from the source repository:

1. Clone the repository: `git clone https://codeberg.org/abiwab/gram.git`
2. Navigate to the extension folder: `cd gram/packages/vscode-extension`
3. Install dependencies and package the extension:
   ```bash
   bun install
   bun run package
   ```
4. This will generate a `.vsix` file. Install it in VS Code by running:
   ```bash
   code --install-extension gram-extension-*.vsix
   ```

Alternatively, for development, you can symlink the extension to your local VS Code extensions folder:
- **Linux / macOS**: `ln -s $(pwd) ~/.vscode/extensions/gram-vscode-extension`
- **Windows**: `New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.vscode\extensions\gram-vscode-extension" -Target $PWD`

## 3. Writing Your First Recipe

Create a new file named `pancakes.gram`.

Open it in your editor and add the following basic recipe:

```gram [pancakes.gram]
---
title: Pancakes
portions: 2
---
## Batter ->&batter

In a #medium bowl{}, mix the @flour{160g}, @baking powder{1 tsp}, @baking soda{1/2 tsp}, @sugar{1 tbsp} and @salt{1/4 tsp}. ->&dry mix{}

To the &dry mix{}, add the @buttermilk{1 cup}, @egg{1} and the @vanilla extract{1/2 tsp}.

## Cooking

Pour the &batter on a #griddle on °{medium heat} and cook for ~{2min}.
```

## 4. Compiling the Recipe

Now, let's use the CLI to compile your recipe into a structured JSON format.

Run the following command in your terminal:

```bash
gram build pancakes.gram
```

This command will parse the recipe and output its structured JSON representation. By default, it prints to the console, but you can save it to a file:

```bash
gram build pancakes.gram -o pancakes.json
```

While the JSON output is incredibly useful for developers building applications around Gram, it is not the most readable format for humans!

To see your recipe rendered directly in your terminal, you can use the `view` command:

```bash
gram view pancakes.gram
```

Alternatively, to see it come to life with a fully formatted visual interface, we highly recommend opening your recipe using the **VS Code Extension** or our **[Web Playground](../playground/index.md)**.

::: tip Try the playground
If you don't want to install anything yet, you can try writing Gram directly in our web-based [Playground](../playground/index.md).
:::

## Next Steps

Now that you have written your first recipe, it's time to dive deeper into the syntax:
- Learn about [Document Structure](../syntax/document-structure.md)
- Learn how to declare [Ingredients](../syntax/ingredients.md)

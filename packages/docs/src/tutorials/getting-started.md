# Getting Started

This guide will help you install the Gram ecosystem and compile your first recipe.

## 1. Installation

Gram is an open-source project. To start using the CLI, clone the repository and build it locally. [Bun](https://bun.sh/) is used as the package manager and runtime.

1. Clone the repository:
   ```bash
   git clone https://codeberg.org/abiwab/gram.git
   cd gram
   ```
2. Install all dependencies across the workspace:
   ```bash
   bun install
   ```
3. Link the CLI globally:
   ```bash
   cd packages/cli
   bun link
   ```

> [!NOTE]
> The `bun link` command registers the `gram` executable globally. Ensure that your `~/.bun/bin` folder is in your system's `PATH`.

## 2. Editor Setup

Because Gram treats recipes as code, having the right editor makes a huge difference.

::: info Gram VS Code Extension
Installing the **Gram VS Code Extension** is highly recommended. It provides:
- Syntax highlighting
- Auto-completion
- Inline diagnostics and error checking
- Real-time compiler feedback
:::

Currently, the extension is not available on the VS Code Marketplace, but you can build and install it locally from the source repository you just cloned:

```bash
# 1. Navigate to the extension folder (from the root of the repository)
cd packages/vscode-extension

# 2. Build the extension package (this generates a .vsix file)
bun run package

# 3. Install the package in VS Code
code --install-extension gram-vscode-extension-*.vsix
```

::: details Alternative: Symlink for Extension Development
For development purposes, you can symlink the extension directly to your local VS Code extensions folder instead of packaging it.

**Linux / macOS**:
```bash
ln -s $(pwd) ~/.vscode/extensions/gram-vscode-extension
```

**Windows (PowerShell)**:
```powershell
New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.vscode\extensions\gram-vscode-extension" -Target $PWD
```
:::

## 3. Initializing a Project

Before writing any recipe, it's highly recommended to initialize a Gram workspace. Run this command in a **new folder**:

```bash
gram init
```

This command scaffolds a `.gram/` directory with a configuration file and a starter database. 

::: tip Interactive Setup
The CLI will ask you a few questions to configure your AI provider (used later for advanced features like database enrichment or importing recipes). You don't need this for your first recipe! Feel free to just press `Enter` to skip or accept the defaults for now.
:::

## 4. Writing Your First Recipe

Let's make some pancakes, shall we? 

Create a new file named `pancakes.gram`, open it in the editor, and add the following basic recipe:

```gram [pancakes.gram]
---
title: Pancakes
portions: 2
---

## Batter ->&batter

In a #medium bowl{}, mix the @flour{160g}, @baking powder{1 tsp}, @sugar{1 tbsp} and @salt{1/4 tsp}. ->&dry mix{}

To the &dry mix{}, add the @buttermilk{1 cup}, @egg{1} and the @vanilla extract{1/2 tsp}.

## Cooking

Pour the &batter on a #griddle on °{medium heat} and cook for ~{2min}.
```

## 5. Compiling the Recipe

Time to see the compiler in action! 

Run the following command in the terminal to compile the recipe into a structured JSON format:

```bash
gram build pancakes.gram
```

This command will parse the recipe and output its structured JSON representation. By default, it prints to the console, but you can save it to a file:

```bash
gram build pancakes.gram -o pancakes.json
```

While the JSON output is incredibly useful for building applications around Gram, it is not the most readable format for humans!

To see your recipe rendered directly in your terminal, you can use the `view` command:

```bash
gram view pancakes.gram
```

Alternatively, to see it come to life with a fully formatted visual interface, it is highly recommended to open the recipe using the **VS Code Extension** or the **[Web Playground](/play/)**.

::: tip Try the playground
If you don't want to install anything yet, you can try writing Gram directly in the web-based [Playground](/play/).
:::

## Next Steps

Now that you have written your first recipe, it's time to dive deeper into the syntax:
- Learn about [Document Structure](../reference/syntax/document-structure.md)
- Learn how to declare [Ingredients](../reference/syntax/ingredients.md)

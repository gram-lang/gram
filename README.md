# GRAM - General Recipe Abstract Markup
**A smart, data-driven recipe markup language for developers.**

![Status](https://img.shields.io/badge/Status-Beta-blue?style=flat-square)
![Open Source](https://img.shields.io/badge/Open%20Source-Yes-brightgreen?style=flat-square)
![License](https://img.shields.io/badge/License-GPL_v3-blue.svg?style=flat-square)

![Gram Banner](gram-banner.png "Gram")

GRAM is a markup language designed to write structured, machine-readable recipes that still read like a normal, human-friendly recipe. It treats your recipes as **code**, compiling ingredients, instructions, and cookware into an Abstract Syntax Tree (AST).

Because GRAM actually understands the data inside your recipe, it unlocks things that are impossible with plain text: precise physical analysis, dynamic scaling, semantic diffs, and interactive cooking.

[**→ Try the Online Playground**](https://abiwab.codeberg.page/gram/) *(or install the CLI to get started locally)*

> **Project Status: Beta (v1.0.0-beta)**
> GRAM has officially entered its Beta phase! The language syntax has stabilized, and a comprehensive suite of developer tools is now available, including a CLI and a Language Server.
> **This is an Open Source project.** Feedback, feature requests, and code contributions are always welcome!

Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for more information on how to get involved.

---

## Why GRAM?

Inspired by the excellent [Cooklang](https://cooklang.org), GRAM takes the concept a step further by introducing structure and programmatic logic.

While other markups focus purely on natural language, GRAM cares deeply about **data integrity** to solve complex culinary problems:

1. **Clear Data Separation**: Explicitly tag ingredients (`@flour{200g}`), cookware (`#bowl{}`), timers (`~{30min}`), and temperatures (`°{230°C}`).
2. **Explicit Actions**: Highlight the main method used in a step (e.g., `[Mix]`, `[Bake]`).
3. **Composite Ingredients (`<@`)**: Cleanly handle tricky relationships like "Zest of 1 lemon" and "Juice of 2 lemons" while ensuring your shopping list aggregates to exactly "Buy 2 Lemons".
4. **Intermediate Preparations (`->&dough`)**: Chain recipe parts together just like variables in code, and reuse them later without accidentally doubling your shopping list totals.
5. **Relative Quantities**: Define `@water{60% @flour}` to handle dynamic baker's math effortlessly.
6. **Smart Aggregation & Mise en Place**: Automatically converts volumes to masses (e.g., `1 cup` -> `125g`) to calculate exact purchasing amounts and yield (Gross vs. Net Mass).
7. **Nutritional Estimation**: Calculates calories and macros automatically using your ingredient database.
8. **Advanced Timers & Scheduling**: Distinguish between active work (`~{10min}`) and background tasks (`~&{2h}`), and use retro-planning (`~{-2d}`) on sections to organize multi-day recipes perfectly.

---

## Quick Syntax

GRAM reads like natural language but compiles like code.

*(Note: The author will provide a more comprehensive example here showcasing all capabilities of GRAM)*

```gram
---
title: Artisanal Bread
size: 2 loaves
description: A simple, highly hydrated dough.
---

## Dough ~{-1d}

[Mix] The @flour{500g}, @water{70% @&flour}, and @salt{10g} in a #large bowl{}. ->&dough

[Rest] Let the &dough rest for ~&{2h} at °{room temperature} until doubled in size.

## Baking

[Preheat] The #oven to °{450°F}.

[Bake] The &dough for ~{35min} until the crust is deeply golden.
```

---

## The Developer Toolchain

To support the language, GRAM comes with a suite of official tools that connect everything together.

### VS Code Extension & Language Server
Transform your editor into a proper recipe development environment.
- **Dynamic Live Preview**: See your recipe rendered in a side panel as you type.
- **Smart Autocomplete**: Contextual suggestions for ingredients from your database, units, and references.
- **Real-time Diagnostics**: Instantly flags missing ingredients, unused references, or circular dependencies.

### The Official CLI (`@gram/cli`)
The command-line interface acts as the keystone of the GRAM workflow.
- **`gram check` & `gram build`**: Validate syntax and compile your `.gram` files to enriched JSON.
- **`gram cook`**: An interactive step-by-step cooking assistant right in your terminal, complete with live timers.
- **`gram scale`**: Dynamically resize your recipes (e.g., `--scale=2` or `--scale flour=300g`) with visual before/after tables.
- **`gram diff`**: A semantic "git diff" for recipes. Instantly see if quantities, timings, or temperatures changed between versions.
- **`gram shop`**: Generate aggregated shopping lists across multiple recipes.
- **`gram suggest`**: Find recipes based on your available ingredients (e.g., `--with "butter, eggs" --without "milk"`).
- **`gram import`**: Scrape a recipe from any URL and let AI automatically translate and convert it into native `.gram` syntax.

### Smart Database Management (`gram db`)
Manage your `ingredients.yaml` effortlessly with AI-assisted commands.
- **`gram db sync`**: Scan your recipes and automatically track new ingredients.
- **`gram db enrich`**: Missing density or nutrition data? Let the AI automatically fill in the gaps.
- **`gram db lint`**: Track down semantic duplicates (e.g., `scallion` vs `green onion`) and plural mistakes to keep your database pristine.

---

## Documentation

The full technical documentation is available in the `docs/` folder.

* [**Start Here: Features Overview**](./docs/features/README.md)
* [**Syntax & Cheatsheet**](./docs/syntax_details/100_cheatsheet.md)
* [**Best Practices**](./docs/syntax_details/98_best_practices.md)
* [**CLI Reference**](./docs/features/07_cli.md)

---

## Project Structure

This monorepo is divided into specialized packages under `packages/`:

* **`parser/`**: The core parser using Ohm.js to generate the AST.
* **`kitchen/`**: The compiler logic, transforming the AST into final JSON structures.
* **`analyzer/`**: The physical resolver for mass normalization, yield, and nutrition.
* **`renderer/`**: The display layer converting JSON into HTML or Markdown.
* **`cli/`**: The official command-line interface.
* **`vscode-extension/`**: The Visual Studio Code extension.
* **`language-server/`**: The LSP providing autocomplete and diagnostics.
* **`i18n/`**: Localization layer for units, categories, and AI prompts.
* **`playground/`**: The web-based IDE to write and visualize GRAM output.

---

## Try it out

**Note**: GRAM is built with `bun`. While other package managers might technically work, it is strongly recommended to use Bun when developing within the monorepo.

### 1. Start a CLI Project
Get started with GRAM directly in your terminal:
```bash
bun add -d @gram/cli
bunx gram init
```

### 2. Run the Playground locally
To inspect the parser or test your recipes in the web-based playground IDE:
```bash
# Install dependencies for all packages
bun install

# Build parser, kitchen, and playground
bun run build 

# Run the playground
bun run dev
```

### 3. Use the Parser in your App
```javascript
import { getAST } from '@gram/parser';
import { compile } from '@gram/kitchen';

const ast = getAST("[Mix] @flour{200g} and @water{100g}.");
const result = compile(ast);

console.log(result.shopping_list);
```

---

## Acknowledgments

GRAM stands on the shoulders of giants.
* **[Cooklang](https://cooklang.org)**: For pioneering the concept of a recipe markup language. GRAM was heavily inspired by their concise syntax.
* **[Ohm.js](https://ohmjs.org)**: For making parsing accessible and incredibly robust.
* **LLM Assistance**: This project was developed with the assistance of AI for rapid prototyping, refactoring, and generating test cases. All logic and architecture were strictly verified by humans.

## License

Distributed under the GPL-3.0 License.
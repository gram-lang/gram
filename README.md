<div align="left">
  <img src="gram-logo.png" width="130" align="left" alt="Gram Logo"/>
  <h1>Gram</h1>
  <p><strong>An open-source markup language for recipes.</strong></p>
  <p>
    <a href="https://git.gram-lang.org/gram-lang/gram/actions"><img src="https://git.gram-lang.org/gram-lang/gram/actions/workflows/ci.yml/badge.svg" alt="Build Status" /></a>
    <a href="https://www.npmjs.com/package/@gram-lang/cli"><img src="https://img.shields.io/npm/v/@gram-lang/cli?color=cb3837&logo=npm" alt="NPM Version" /></a>
    <a href="https://marketplace.visualstudio.com/items?itemName=gram-lang.gram-lang"><img src="https://vsmarketplacebadges.dev/version-short/gram-lang.gram-lang.svg?style=flat-square&color=007acc" alt="VS Code Extension" /></a>
    <img src="https://img.shields.io/badge/Open%20Source-Yes-brightgreen" alt="Open Source" />
    <img src="https://img.shields.io/badge/License-GPL_v3-blue.svg" alt="License" />
    <img src="https://img.shields.io/badge/Made%20in-Europe-003399?labelColor=003399&logo=europeanunion&logoColor=FFFFFF" alt="Made in Europe" />
  </p>
</div>
<br clear="left"/>

Treat your recipes like code. Built to handle complex culinary logic, Gram compiles your plain-text instructions into structured, predictable, and relational data.

[Playground](https://play.gram-lang.org) • [Documentation](https://docs.gram-lang.org/)

<br/>
<div align="center">
  <img src="screenshot.png" alt="Gram Playground Screenshot" style="border-radius: 8px;" />
</div>
<br/>

> [!NOTE]
> I develop **Gram** on my primary [Forgejo instance](https://git.gram-lang.org/gram-lang/gram), with automatic mirrors on [GitHub](https://github.com/gram-lang/gram) and [Codeberg](https://codeberg.org/gram-lang/gram).  

> Contributions, issues, and discussions are welcome on any of these platforms.

Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for more information on how to get involved.

---

## Design Philosophy & Key Features

Gram turns plain-text recipes into structured, queryable data while keeping them easy to read and write.

* **Plain Text**: Recipes are saved as simple `.gram` text files, so you can track changes with Git and use any text editor.
* **Dynamic Calculations**: Declare Baker's percentages, relative quantities (`@water{75% @&flour}`), and automatic unit conversions directly in your recipe.
* **Step References & Variables**: Reuse intermediate preparations (`->&dough`) and sub-ingredients (`<@lemons{2}`) without messing up shopping list totals.
* **Timers & Gantt Charts**: Separate active steps (`~{10min}`) from background waiting times (`~_{2h}`) to generate recipe timelines and Gantt charts.
* **Developer Tooling**: Includes a Language Server (LSP), a VS Code extension with real-time diagnostics, a CLI tool, and a TypeScript API.

---

## Quick Syntax

Gram reads like natural language but compiles like code.

```gram
---
title: Artisanal Bread
size: 2 loaves
description: A simple, highly hydrated dough.
---

## Dough

[Mix] The @flour{500g}, @water{70% @&flour}, and @salt{10g} in a #large bowl{}. ->&dough

[Rest] Let the &dough rest for ~_{2h} at ^{room temperature} until doubled in size.

## Baking

[Preheat] The #oven to ^{450F}.

[Bake] The &dough for ~{35min} until the crust is deeply golden.
```

---

## Tooling

Gram comes with tools to help write, inspect, and compile recipes.

### VS Code Extension & Language Server
[**Available on the VS Code Marketplace**](https://marketplace.visualstudio.com/items?itemName=gram-lang.gram-lang)
- **Live Preview & Gantt View**: Side-by-side recipe rendering and real-time Gantt charts for active steps and background timers.
- **Autocomplete**: Contextual suggestions for ingredients from your database, units, and step references.
- **Diagnostics**: Real-time error checking for missing ingredients, unused references, or circular dependencies.

### CLI (`@gram-lang/cli`)
[**View on npmjs**](https://www.npmjs.com/package/@gram-lang/cli)
- **`gram check` & `gram build`**: Validate syntax and compile `.gram` files to JSON.
- **`gram cook`**: Step-by-step cooking assistant in your terminal with live timers.
- **`gram scale`**: Resize recipes (e.g., `--scale=2` or `--scale flour=300g`) with before/after comparison tables.
- **`gram diff`**: Semantic diff to compare quantities, timings, or temperatures between recipe versions.
- **`gram shop`**: Generate aggregated shopping lists across multiple recipes.
- **`gram suggest`**: Find recipes based on available ingredients (e.g., `--with "butter, eggs"`).
- **`gram import`**: Convert recipes from external URLs into `.gram` files.

### Database Tooling (`gram db`)
Commands to maintain your `ingredients.yaml` file:
- **`gram db sync`**: Scan recipes and add missing ingredients to your database.
- **`gram db enrich`**: Fill in missing density and nutrition data using AI suggestions.
- **`gram db lint`**: Find duplicates (e.g., `scallion` vs `green onion`) and fix plural inconsistencies.

---

## Documentation

The full technical documentation is available online:
[**https://docs.gram-lang.org/**](https://docs.gram-lang.org/)

The source code for the Astro & Starlight documentation can be found locally in `packages/docs/`.

---

## Project Structure

This monorepo is divided into specialized packages under `packages/`:

| Package | Version | Description |
|---|---|---|
| [**`@gram-lang/parser`**](./packages/parser/README.md) | [![npm](https://img.shields.io/npm/v/@gram-lang/parser?color=cb3837&style=flat-square)](https://www.npmjs.com/package/@gram-lang/parser) | The core parser using Ohm.js to generate the AST. |
| [**`@gram-lang/kitchen`**](./packages/kitchen/README.md) | [![npm](https://img.shields.io/npm/v/@gram-lang/kitchen?color=cb3837&style=flat-square)](https://www.npmjs.com/package/@gram-lang/kitchen) | The compiler logic, transforming the AST into final JSON structures. |
| [**`@gram-lang/format`**](./packages/format/README.md) | [![npm](https://img.shields.io/npm/v/@gram-lang/format?color=cb3837&style=flat-square)](https://www.npmjs.com/package/@gram-lang/format) | Canonical `.gram` source code formatter. |
| [**`@gram-lang/analyzer`**](./packages/analyzer/README.md) | [![npm](https://img.shields.io/npm/v/@gram-lang/analyzer?color=cb3837&style=flat-square)](https://www.npmjs.com/package/@gram-lang/analyzer) | The physical resolver for mass normalization, yield, and nutrition. |
| [**`@gram-lang/renderer`**](./packages/renderer/README.md) | [![npm](https://img.shields.io/npm/v/@gram-lang/renderer?color=cb3837&style=flat-square)](https://www.npmjs.com/package/@gram-lang/renderer) | The display layer converting JSON into HTML, Markdown, or Gantt Charts. |
| [**`@gram-lang/cli`**](./packages/cli/README.md) | [![npm](https://img.shields.io/npm/v/@gram-lang/cli?color=cb3837&style=flat-square)](https://www.npmjs.com/package/@gram-lang/cli) | The official command-line interface. |
| [**`@gram-lang/i18n`**](./packages/i18n/README.md) | [![npm](https://img.shields.io/npm/v/@gram-lang/i18n?color=cb3837&style=flat-square)](https://www.npmjs.com/package/@gram-lang/i18n) | Localization layer for units, categories, and AI prompts. |
| [**`vscode-extension`**](./packages/vscode-extension/README.md) | [![VS Code Marketplace](https://vsmarketplacebadges.dev/version-short/gram-lang.gram-lang.svg?style=flat-square&color=007acc)](https://marketplace.visualstudio.com/items?itemName=gram-lang.gram-lang) | The Visual Studio Code extension. |
| [**`@gram-lang/language-server`**](./packages/language-server/README.md) | [![npm](https://img.shields.io/npm/v/@gram-lang/language-server?color=cb3837&style=flat-square)](https://www.npmjs.com/package/@gram-lang/language-server) | The LSP providing autocomplete and diagnostics. |
| **`docs`** | - | The documentation website, which includes the web-based Playground IDE. |

---

## Development & CI

Gram uses **Forgejo Actions** to maintain the stability of the language and its tooling.
On every push and pull request, the CI pipeline automatically runs:
- **Linting & Formatting**: Enforced by Biome (`bun run lint`).
- **Typechecking**: Across the entire TypeScript monorepo (`bun run typecheck`).
- **Unit Tests**: For isolated component logic (`bun test`).
- **Conformance Tests**: A custom suite of golden tests (`bun run conformance`) that ensures the parser and compiler produce stable, byte-for-byte identical AST and JSON outputs for any given `.gram` input.

---

## Try it out

### 1. Start a CLI Project
Get started with Gram directly in your terminal:
```bash
npm install -g @gram-lang/cli
gram init
# or, with Bun
bun add -g @gram-lang/cli
gram init
```
The CLI runs on both Node.js (>=20) and Bun — pick whichever you already have installed.

### 2. Run the Docs & Playground locally

**Note**: contributing to this monorepo (building every package, running the test suite, the docs dev server) requires `Bun` — see [CONTRIBUTING.md](./CONTRIBUTING.md).

```bash
# Install dependencies for all packages
bun install

# Build packages and start the docs dev server
bun run dev
```

### 3. Use the Parser in your App
```javascript
import { getAST } from '@gram-lang/parser';
import { compile } from '@gram-lang/kitchen';

const ast = getAST("[Mix] @flour{200g} and @water{100g}.");
const result = compile(ast);

console.log(result.shopping_list);
```

---

## Acknowledgments

Gram stands on the shoulders of giants.
* **[Cooklang](https://cooklang.org)**: For pioneering the concept of a recipe markup language. Gram was heavily inspired by their concise syntax.
* **[Ohm.js](https://ohmjs.org)**: For making parsing accessible and incredibly robust.
* **LLM Assistance**: This project was developed with the assistance of AI for rapid prototyping, refactoring, and generating test cases. All logic and architecture were strictly verified by humans.

## License

Distributed under the GPL-3.0 License.
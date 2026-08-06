# @gram-lang/kitchen

[![npm version](https://badge.fury.io/js/@gram-lang%2Fkitchen.svg)](https://www.npmjs.com/package/@gram-lang/kitchen)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

*Part of the [Gram monorepo](https://git.gram-lang.org/gram-lang/gram).*

The compiler for the Gram recipe language. It takes a typed Recipe AST (produced by `@gram-lang/parser`) and compiles it into a structured, minified recipe JSON (aggregating shopping lists, processing sections, and calculating Gantt-like timings).

---

## 📚 General Documentation

For full syntax specifications, grammar details, cheatsheets, and best practices, please refer to the **[Gram Documentation](https://docs.gram-lang.org/)**.

---

## 🛠️ Installation

```bash
npm install @gram-lang/kitchen
# or
bun add @gram-lang/kitchen
```

---

## ⚡ Usage

```javascript
import { getAST } from '@gram-lang/parser';
import { compile } from '@gram-lang/kitchen';

const source = `
## My Recipe
[Mix] @flour{200g} and @water{100ml} for ~{5min}.
`;

const ast = getAST(source);
const result = compile(ast);

console.log(result.shopping_list);
console.log(result.metrics.activeTime); // Timing calculations (in minutes)
```

---

## 🏗️ Structure

*   `src/core.ts`: The main compiler entry point.
*   `src/processor.ts`: Processes step-by-step block content, local scopes, and timings.
*   `src/section.ts`: Compiles individual recipe sections.
*   `src/shopping.ts`: Deduplicates and aggregates ingredients into a master shopping list.
*   `src/metrics.ts`: Computes baseline active preparation times.
*   `src/graph.ts`: Traverses relative quantities and runs cycle detection (DFS).
*   `src/registry.ts`: Tracks declared ingredients, cookware, and references across the recipe.
*   `src/scale/`: Applies scale factors to quantities throughout the compiled recipe.
*   `src/warnings.ts`: Collects non-fatal compilation warnings.
*   `src/schemas.ts`: Zod schemas for compiler options.
*   `src/utils.ts`: Includes helpers for string slugification, minification, and time unit conversions.

---

## 📄 License

This project is licensed under the GPL-3.0 License.

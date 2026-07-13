# @gram-lang/kitchen

The compiler for the Gram recipe language. It takes a typed Recipe AST (produced by `@gram-lang/parser`) and compiles it into a structured, minified recipe JSON (aggregating shopping lists, processing sections, and calculating Gantt-like timings).

---

## 📚 General Documentation

For full syntax specifications, grammar details, cheatsheets, and best practices, please refer to the **[Gram Documentation](https://gram-lang.org/)**.

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
*   `src/shopping.ts`: Deduplicates and aggregates ingredients into a master shopping list.
*   `src/metrics.ts`: Computes baseline active preparation times.
*   `src/graph.ts`: Traverses relative quantities and runs cycle detection (DFS).
*   `src/utils.ts`: Includes helpers for string slugification, minification, and time unit conversions.

---

## 📄 License

This project is licensed under the GPL-3.0 License.

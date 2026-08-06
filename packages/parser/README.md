# @gram-lang/parser

[![npm version](https://badge.fury.io/js/@gram-lang%2Fparser.svg)](https://www.npmjs.com/package/@gram-lang/parser)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

A robust, 3-stage parser for the Gram recipe language. It is part of the [Gram monorepo](https://git.gram-lang.org/gram-lang/gram) and is strictly limited to text-to-AST parsing.

---

## 📚 General Documentation

For full syntax specifications, grammar details, cheatsheets, and best practices, please refer to the **[Gram Documentation](https://docs.gram-lang.org/)**.

---

## 🛠️ Installation

```bash
npm install @gram-lang/parser
# or
bun add @gram-lang/parser
```

---

## ⚡ Usage

The package exports `getAST()` to convert Gram source strings into a typed Recipe AST.

```javascript
import { getAST } from '@gram-lang/parser';

const source = `
## My Recipe
Mix @flour{200g} and @water{100ml}.
`;

try {
    const ast = getAST(source);
    console.log(JSON.stringify(ast, null, 2));
} catch (e) {
    console.error("Parsing error:", e.message);
}
```

## 🏗️ Structure

*   `src/index.ts`: Orchestrates parsing and Ohm Semantics to AST conversions.
*   `src/types.ts`: Declares strictly-typed AST node definitions.
*   `grammar.ohm`: The official OhmJS grammar defining the Gram language structure.

---

## 📄 License

This project is licensed under the GPL-3.0 License.

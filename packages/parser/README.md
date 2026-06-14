# @gram/parser

A robust, 3-stage parser for the GRAM recipe language. It is part of the GRAM monorepo and is strictly limited to text-to-AST parsing.

---

## 📚 General Documentation

For full syntax specifications, grammar details, cheatsheets, and best practices, please refer to the central **[GRAM Documentation Index](../../docs/README.md)**.

---

## Building

To build the project from source (TypeScript):

```bash
bun install
bun run build
```

This will generate the compiled JavaScript in the `dist/` directory.

---

## ⚡ Usage

The package exports `getAST()` to convert GRAM source strings into a typed Recipe AST.

```javascript
const { getAST } = require('@gram/parser');

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
*   `grammar.ohm`: The official OhmJS grammar defining the GRAM language structure.

---

## 📄 License

This project is licensed under the GPL-3.0 License - see the [LICENSE](../LICENSE) file for details.

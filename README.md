# GRAM - General Recipe Abstract Markup
**A strictly typed, data-first recipe markup language for developers.**

![Status](https://img.shields.io/badge/Status-In%20Development-orange?style=flat-square)
![Open Source](https://img.shields.io/badge/Open%20Source-Yes-brightgreen?style=flat-square)
![License](https://img.shields.io/badge/License-GPL_v3-blue.svg?style=flat-square)

![Gram Banner](gram-banner.png "Gram")

GRAM is designed to write structured, machine-readable recipes without sacrificing readability. It treats recipes as **code**, compiling ingredients, instructions, and cookware into a strict AST (Abstract Syntax Tree) for precise analysis, scaling, and shopping list generation.

[**👉 Try the Online Playground**](https://abiwab.codeberg.page/gram/) *(or run it locally)*

> **🚧 Project Status: Active Development**
> GRAM is currently in an **Alpha stage**. The syntax specification is stabilizing, but the parser logic is actively being refined. Breaking changes may occur.
> **This is an Open Source project.** We believe standardizing recipe data requires a community effort. Feedback, feature requests, and code contributions are highly welcome!

Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for more information on how to contribute to GRAM.

---

## 📚 Documentation

The full technical documentation is available in the `docs/` folder.

*   [**Start Here: Documentation Index**](./docs/syntax_details/README.md)
*   [**Full Cheatsheet**](./docs/syntax_details/100_cheatsheet.md)
*   [**Best Practices**](./docs/syntax_details/98_best_practices.md)

---

## 🥘 Why GRAM?

Inspired by the excellent [Cooklang](https://cooklang.org), GRAM evolves the concept by enforcing a **strict schema** and advanced logic capabilities.

While Cooklang focuses on natural language fluidity, GRAM prioritizes **data integrity** and **computational logic**:

1.  **Data vs. Narrative:** Clear separation between ingredients (`@flour{200g}`) and instructions.
2.  **Mise en Place:** Distinguishes between the **Shopping List** (Aggregated totals) and the **Section List** (What you need on the table right now).
3.  **Complex Relationships:**
    *   **References (`@&`)**: Reuse previously measured ingredients without doubling the shopping list amount.
    *   **Intermediate Preparations (`->&dough`)**: Chain recipe parts like variables.
    *   **Relative Quantities**: Define `@water{60% @flour}` for dynamic bakers math.
    *   **Mass Unification**: Automatically converts volumes and units to grams (e.g., `1 cup flour` -> `125g`).
    *   **Composites**: Handle "Zest of 1 lemon" and "Juice of 1 lemon" implying "Buy 1 Lemon".

---

## ⚡ Quick Syntax

```gram
## Dough {T-2h} 

[Mix] The @flour{200g} and @water{100ml}. ->&dough{}

[Add] The &dough{} to a #bowl{}.

[Rest] For ~{30min}.

[Bake] In the #oven{} at !{200°C}.
```

You can find more real-world examples in the `examples/` directory at the root of the project.

---

## 🛠️ Project Structure

This monorepo contains the following packages in `packages/`:

*   **`parser/`**: The core parser. Converts GRAM strings to an AST (Abstract Syntax Tree).
*   **`compiler/`**: The compiler logic. Transforms the AST into the final Shopping List and Instructions JSON.
*   **`playground/`**: A web-based IDE to write GRAM and visualize the output (JSON, Markdown, Preview).

And:
*   **`vscode-extension/`**: The Visual Studio Code extension (located in `packages/vscode-extension/`).

---

## 🤝 Contributing

**We need your help to make GRAM the standard for structured recipes!**

Whether you are a developer, a chef, or a data enthusiast, your contributions are welcome.

* **Found a bug?** Open an issue to help us squash it.
* **Have an idea?** Start a discussion on syntax improvements.
* **Want to code?** Fork the repo and submit a Pull Request.

---

## 📦 Try it out

### 1. Run the Playground locally
To inspect the parser or test your recipes in the web-based playground IDE:

```bash
# Install dependencies for all packages
npm install

# Build parser, compiler, and playground
npm run build 

# Run the playground
npm run dev
```

### 2. Use the Parser

*(See `parser/README.md` for API details)*

```javascript
const { getAST } = require('gram-parser');
const { compile } = require('gram-compiler');

const ast = getAST(myGramString);
const result = compile(ast);

console.log(result.shopping_list);
```

## 👏 Acknowledgments

GRAM stands on the shoulders of giants.
* **[Cooklang](https://cooklang.org)**: For pioneering the concept of a recipe markup language. GRAM was heavily inspired by their concise syntax.
* **[Ohm.js](https://ohmjs.org)**: For making parsing accessible and robust.
* **LLM Assistance**: This project was developed with the assistance of AI for rapid prototyping, refactoring, and generating test cases. All logic and architecture were strictly verified by humans.

## License

Distributed under the GPL-3.0 License.
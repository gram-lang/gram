# GRAM - General Recipe Abstract Markup
**A structured, data-first recipe markup language for developers.**

![Status](https://img.shields.io/badge/Status-Beta-orange?style=flat-square)
![Open Source](https://img.shields.io/badge/Open%20Source-Yes-brightgreen?style=flat-square)
![License](https://img.shields.io/badge/License-GPL_v3-blue.svg?style=flat-square)

![Gram Banner](gram-banner.png "Gram")

GRAM is designed to write structured, machine-readable recipes without sacrificing human readability. It treats recipes as **code**, compiling ingredients, instructions, and cookware into a strict AST (Abstract Syntax Tree) for precise analysis, yield management, and intelligent IDE tooling.

[**👉 Try the Online Playground**](https://abiwab.codeberg.page/gram/) *(or run it locally)*

> **🚧 Project Status: Beta Development**
> The GRAM syntax and the core architecture have stabilized into a modern Pipeline architecture (Parser -> Analyzer -> Kitchen). The engine currently powers a full-featured VS Code extension.
> **This is an Open Source project.** Feedback, feature requests, and code contributions are highly welcome!

Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for more information on how to contribute to GRAM.

---

## 🥘 Why GRAM?

Inspired by the excellent [Cooklang](https://cooklang.org), GRAM evolves the concept by enforcing a **strict structural schema** that allows for deep programmatic analysis.

If Cooklang focuses on natural language fluidity, GRAM prioritizes **data integrity, computational logic, and predictability**:

1. **A Data-First Approach:** GRAM treats recipes as structured data sets rather than simple formatted text. It builds a robust AST that third-party tools can safely traverse.
2. **Data vs. Narrative:** A strict separation between ingredients (`@flour{200g}`) and instructions ensures that your recipes are perfectly parseable data structures.
3. **Mise en Place:** GRAM distinguishes between the **Shopping List** (Aggregated totals to buy) and the **Section List** (What you need on the table right now).
4. **Advanced Syntax Features:**
    *   **Actions (`[Mix]`)**: Highlights the main method used in a step.
    *   **References (`@&`)**: Reuse previously measured ingredients without doubling the shopping list amount.
    *   **Intermediate Preparations (`->&dough`)**: Chain recipe parts like variables.
    *   **Relative Quantities**: Define `@water{60% @flour}` for dynamic baker's math.
    *   **Composites**: Handle "Zest of 1 lemon" and "Juice of 2 lemon" implying "Buy 2 Lemons".
5. **Physical Analyzer & Nutrition:**
    *   **Mass Unification**: Automatically converts volumes and units to grams (e.g., `1 cup flour` -> `125g`).
    *   **Yield Management**: Understands that buying `1 avocado` results in `~135g` of edible flesh (Purchasing vs. Net Mass).
    *   **Nutritional Estimation**: Automatically calculates calories and macros based on a user-provided ingredient database.

→ See the [**full feature list**](./docs/README.md) for more details.

---

## ⚡ Quick Syntax

```gram
## Dough {T-2h} 

[Mix] The @flour{200g} and @water{100ml}. ->&dough{}

[Add] The &dough{} to a #bowl{}.

[Rest] For ~{30min}.

[Bake] In the #oven{} at !{200°C}.
```

You can find more real-world examples in the Playground or by exploring the test fixtures in the `packages/` directory.

---

## 🛠️ Project Structure

This monorepo contains the following modular packages in `packages/`:

*   **`parser/`**: The core lexer/parser. Converts GRAM string text to a precise AST (Abstract Syntax Tree).
*   **`analyzer/`**: The physical resolver. Handles mass normalization, yield management, and nutritional estimation based on an external ingredient database.
*   **`kitchen/`**: The culinary data aggregator. It takes the validated AST and generates real-world views like the Shopping List and the Preparation Graph.
*   **`renderer/`**: The display layer. Converts the compiled JSON into beautiful Markdown or HTML.
*   **`i18n/`**: The localization layer. Centralizes translation dictionaries and unit mappings across languages.
*   **`language-server/`**: The Language Server Protocol (LSP) implementation powering the IDE intelligence (hover, autocompletion, diagnostics).
*   **`vscode-extension/`**: The official Visual Studio Code client extension.
*   **`playground/`**: A web-based IDE running the parser natively in the browser to visualize the output in real-time.

---

## 🤝 Contributing

**We need your help to make GRAM the standard for structured recipes!**

Whether you are a developer, a chef, or a data enthusiast, your contributions are welcome.

* **Found a bug?** Open an issue to help us squash it.
* **Have an idea?** Start a discussion on syntax improvements.
* **Want to code?** Fork the repo and submit a Pull Request.

---

## 📦 Try it out

The GRAM engine is built natively as **Pure ESM**. You can use it universally in Node.js or the browser.

### 1. Run the Playground locally
To inspect the parser or test your recipes in the web-based playground IDE:

```bash
# Install dependencies for all packages
bun install

# Build the ecosystem
bun run build 

# Run the playground
bun run dev
```

### 2. Use the Parser API

*(See `packages/parser/README.md` for API details)*

```javascript
import { getAST } from '@gram/parser';
import { compile } from '@gram/kitchen';

const ast = getAST(myGramString);
const result = compile(ast);

console.log(result.shopping_list);
```

---

## 👏 Acknowledgments

GRAM stands on the shoulders of giants.
* **[Cooklang](https://cooklang.org)**: For pioneering the concept of a recipe markup language. GRAM was heavily inspired by their concise syntax.
* **[Ohm.js](https://ohmjs.org)**: For making parsing accessible and robust.
* **LLM Assistance**: This project was developed with the assistance of AI for rapid prototyping, refactoring, and generating test cases. All logic and architecture were strictly verified by humans.

## License

Distributed under the GPL-3.0 License.
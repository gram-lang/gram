# Contributing to Gram

First off, thank you for considering contributing to Gram! This project means a lot to me and I hope that it will resonate with other geeky cooks and developers !

## 👋 Welcome

Gram is an open source project dedicated to treating recipes as code. Whether you're a developer, a chef, or a data enthusiast, your input is valuable. I welcome contributions of all forms:
*   🐛 **Bug Reports**
*   💡 **Feature Requests & Syntax Proposals**
*   📝 **Documentation Improvements**
*   💻 **Code Contributions**
*   🥘 **Recipe Examples**: Feel free to submit new `.gram` files to the `examples/` directory to help test the language!

## 🛠️ Project Structure

Gram is a **monorepo** organized in a `packages/` directory:

1.  **`parser/`**: The core parser. Contains the OhmJS grammar definition and converts strings to an AST.
2.  **`kitchen/`**: The compiler. Processes the AST to generate structured results and warnings.
3.  **`analyzer/`**: The physical layer. Connects to ingredient databases to normalize units and calculate nutrition.
4.  **`renderer/`**: The display layer. Converts the compiled JSON into Markdown or HTML.
5.  **`i18n/`**: The translation and localization layer.
6.  **`cli/`**: The official command-line interface (`gram`).
7.  **`language-server/`**: The LSP implementation providing editor intelligence.
8.  **`vscode-extension/`**: The Visual Studio Code extension for syntax highlighting, built on `language-server/`.
9.  **`docs/`**: The documentation website, including the web-based playground.

## 🤝 How to Contribute

### Reporting Bugs
If you find a bug (parser error, wrong highlighting, etc.), please create a **Codeberg Issue** comprising:
*   A clear title and description.
*   Steps to reproduce (a snippet of the code causing the issue is huge help!).
*   Expected vs. actual behavior.

### Suggesting Enhancements (RFCs)
Gram is a language specification. Changes to valid syntax are significant.
*   If you want to propose a **syntax change**, please open a Discussion or an Issue labeled **RFC** (Request for Comments).
*   Describe *why* the change is needed and provide examples of how it would look.

### Pull Requests
1.  **Create a branch** for your feature or fix:
   ```bash
   git checkout -b feature/amazing-new-feature
   ```
2.  **Make your changes**.
3.  **Test your changes**.
   *   For the core logic, run the test suite via `bun run test` at the root. If you changed syntax or expected JSON outputs, use `bun test --update-snapshots` to visually confirm and lock your changes.
   *   For the playground, verify it runs via `bun run dev`.
4.  **Commit** your changes with clear messages.
5.  **Push** to your fork.
6.  **Open a Pull Request** against the `main` branch of the `gram` repository.

## 📐 Coding Standards

*   **No heavy frameworks**: The parser and playground are designed to be lightweight. Avoid adding large dependencies unless discussed.
*   **OhmJS**: If modifying the grammar (`.ohm`), ensure you understand how OhmJS handles semantic actions.

## 🤖 A Note on AI & Modern Tools

I believe in using the best tools for the job. To be fully transparent, the core of Gram was built with the assistance of AI acting as a tireless pair programmer.

**I am open to AI-assisted contributions!**
If using ChatGPT, Claude, Gemini or Copilot helps you be more creative or productive, go for it. My only request is that you act as the **lead pilot**: please review the code, understand how it fits into the architecture, and ensure it passes the tests. I trust your judgment over the machine's output.

## 📜 License

By contributing to Gram, you agree that your contributions will be licensed under the **GPL-3.0** License.
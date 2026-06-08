# @gram/playground

The official browser-based playground for the **GRAM Language**. It allows you to write, edit, and physically analyze recipes in real-time.

---

## 📚 General Documentation

For full syntax specifications, grammar details, cheatsheets, and best practices, please refer to the central **[GRAM Documentation Index](../../docs/README.md)**.

---

## ⚡ Features

*   **Real-time Rendering**: Instantly compiles your recipe into JSON, Markdown, and a gorgeous interactive Preview card.
*   **Physical Analysis**: Simulates Net vs Gross weights and nutritional macronutrient curves dynamically by loading a CIQUAL/USDA derived database.
*   **Gantt Scheduler**: Displays active and total durations dynamically.
*   **Pre-built Example Library**: Access various recipes to quickly learn the grammar.
*   **Deduplicated Tree Explorer**: Browse the nested JSON output interactively.

---

## 🛠️ Local Development & Running

To run the playground locally from the repository root:

1.  **Install Monorepo Dependencies**:
    ```bash
    npm install
    ```
2.  **Build the Parser, Compiler, Analyzer, and Renderer**:
    ```bash
    npm run build
    ```
3.  **Start the Playground Dev Server**:
    ```bash
    npm run dev
    ```
    Open `http://localhost:3000` in your web browser.

---

## 🏗️ Bundle Process

*   The playground uses **esbuild** (`build.js`) to bundle all sources (shims, styles, external dependencies) into the `dist/` directory.
*   The large ingredient database is compiled into a lazy-loaded chunk (`chunks/db_bundle.js`) to ensure fast page loads.

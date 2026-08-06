# @gram-lang/cli

[![npm version](https://badge.fury.io/js/@gram-lang%2Fcli.svg)](https://www.npmjs.com/package/@gram-lang/cli)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

*Part of the [Gram monorepo](https://git.gram-lang.org/gram-lang/gram).*

The official command-line tool for the Gram recipe language. Validate, compile, scale, diff, and manage your ingredient database directly from your terminal.

---

## 📚 General Documentation

For full syntax specifications, command reference, and best practices, please refer to the **[Gram Documentation](https://docs.gram-lang.org/)**.

---

## 🛠️ Installation

```bash
npm install -g @gram-lang/cli
# or
bun add -g @gram-lang/cli
```

This installs the `gram` executable globally.

---

## ⚡ Usage

```bash
# Initialize a new Gram project in the current directory
gram init

# Validate a recipe file
gram check my-recipe.gram

# Format a recipe file to canonical style
gram format my-recipe.gram

# Compile a recipe to JSON
gram build my-recipe.gram --output dist/

# Scale a recipe (e.g. double the quantities)
gram scale my-recipe.gram --scale 2

# Compare two versions of a recipe
gram diff v1.gram v2.gram
```

Run `gram --help` for the full list of commands.

---

## 🏗️ Structure

*   `src/index.ts`: CLI entry point, registers all subcommands.
*   `src/commands/`: One file per subcommand (`init`, `check`, `format`, `build`, `scale`, `diff`, `import`, `db`, ...).
*   `src/core/`: Shared building blocks (config loading, ingredient database, pipeline orchestration).
*   `src/services/`: Business logic backing the commands (formatting, scaling, importing, syncing).
*   `src/ui/`: Terminal rendering (tables, diffs, interactive views).
*   `src/prompts/`: AI system prompts used by the `suggest` command.

---

## 📄 License

This project is licensed under the GPL-3.0 License.

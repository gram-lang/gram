# @gram-lang/cli

[![npm version](https://badge.fury.io/js/@gram-lang%2Fcli.svg)](https://www.npmjs.com/package/@gram-lang/cli)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

*Part of the [Gram monorepo](https://git.gram-lang.org/gram-lang/gram).*

The official command-line tool for the Gram recipe language. Validate, compile, view, plan, scale, diff, and manage your ingredient database directly from your terminal.

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

# Read a recipe in the terminal, in your language
gram view my-recipe.gram
gram view my-recipe.gram --mise-en-place upfront --rests longest

# Plan a recipe: the days of work, the visits to the kitchen, what to take out.
# Backward from a serving time, within the hours you can cook
gram plan my-recipe.gram --serve "2026-10-11 13:00" --available 08:00-22:00
gram plan my-recipe.gram --find 2026-10-12/2026-10-15   # the serving times that work

# Export or print the recipe, or its run sheet
gram export my-recipe.gram --format html
gram print my-recipe.gram --view run-sheet --serve "2026-10-11 13:00"

# Cook step by step, with live timers
gram cook my-recipe.gram

# Aggregate the shopping list of the recipes matching a path or a glob
gram shop "menus/*.gram"
```

Run `gram --help` for the full list of commands.

---

## 🏗️ Structure

*   `src/index.ts`: CLI entry point, registers all subcommands.
*   `src/commands/`: One file per subcommand (`init`, `check`, `format`, `build`, `view`, `plan`, `export`, `print`, `cook`, `scale`, `diff`, `shop`, `import`, `db`, ...).
*   `src/core/`: Shared building blocks (config loading, ingredient database, pipeline orchestration).
*   `src/services/`: Business logic backing the commands (formatting, scaling, importing, syncing).
*   `src/ui/`: Terminal rendering (tables, diffs, interactive views).
*   `src/prompts/`: AI system prompts used by the `import` command (recipe specification, video transcription).

---

## 📄 License

This project is licensed under the GPL-3.0 License.

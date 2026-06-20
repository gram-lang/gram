# Command Line Interface (CLI)

The official GRAM CLI (`@gram/cli`) is the primary tool for validating, compiling, and managing your recipe collections locally. It acts as the bridge between your `.gram` files and the rest of your technical stack (SSG, Next.js, mobile apps, etc.).

## Installation

The CLI can be installed globally or locally in your project:

```bash
bun add -d @gram/cli
```

---

## Core Commands

The CLI is currently in its V1 phase and offers the foundational tools needed to validate and compile recipes.

### `gram init`

Scaffolds a new GRAM environment in the current directory.

```bash
gram init
```

**What it does:**
- Creates a `.gram/` directory.
- Generates a heavily commented `config.yaml` template.
- Generates a starter `ingredients.yaml` ingredient database.
- Generates a `.gitignore` to prevent committing sensitive keys.

### `gram check [pattern]`

Validates your `.gram` files for syntax errors and structural integrity.

```bash
gram check "**/*.gram"
```

**What it does:**
- Runs the OhmJS parser to catch syntax errors (e.g. missing braces, invalid headers).
- Runs the Kitchen compiler to catch structural errors (e.g. referencing an undefined `&intermediate`, cyclic dependencies).
- Connects to your `ingredients.yaml` (if present) to warn you about any ingredients that are not documented in your database.

**Output:**
The output is grouped logically by file, separating critical `[Structure]` errors from non-blocking `[Database]` warnings.

### `gram build [pattern]`

Compiles your `.gram` recipes into the final, minified JSON format.

```bash
# Output everything to a dist/ directory
gram build "**/*.gram" --output ./dist

# Compile a single file and output formatted JSON to the terminal
gram build brioche.gram --pretty
```

**What it does:**
- Parses the AST and resolves the shopping list and Gantt timings.
- Automatically connects to the analyzer to compute nutritional data and physical mass normalization (unless `--skip-db` is passed).
- **Unix Philosophy**: By default, if `--output` is omitted, the CLI outputs pure JSON directly to `stdout` with absolutely no decorative logs. This allows you to pipe the output seamlessly into tools like `jq` or external APIs.

---

## Configuration

By default, the CLI looks for a `.gram/config.yaml` and `.gram/ingredients.yaml` in the directory from which the command is run. 

You can manually override the database path during commands:
```bash
gram build --db ./my-custom-db.yaml
```

## Roadmap

Future versions of the CLI will introduce:
- `gram db extract`: Automatically extract undefined ingredients from your recipes into your database.
- `gram view`: A beautifully styled terminal viewer for your recipes.
- `gram shop`: Generate an aggregated shopping list across multiple recipes.

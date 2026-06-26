# Command Line Interface (CLI)

The official GRAM CLI (`@gram/cli`) is the primary tool for validating, compiling, and managing your recipe collections locally. It acts as the bridge between your `.gram` files and the rest of your technical stack (SSG, Next.js, mobile apps, etc.).

## Installation

The CLI can be installed globally or locally in your project:

```bash
bun add -d @gram/cli
```

---

## Core Commands

### Project Management

#### `gram init`
Scaffolds a new GRAM environment in the current directory.
- Creates a `.gram/` directory.
- Generates a heavily commented `config.yaml` template.
- Interactively configures your preferred AI provider and model.
- Generates/updates a `.env` file for your AI API keys.
- Generates a starter `ingredients.yaml` ingredient database.
- Generates a `.gitignore` to prevent committing sensitive keys.

#### `gram check [pattern]`
Validates your `.gram` files for syntax errors, structural integrity, and undefined ingredients.
- Runs the OhmJS parser to catch syntax errors.
- Runs the Kitchen compiler to catch structural errors (e.g., cyclic dependencies).
- Connects to your `ingredients.yaml` to warn about ingredients not documented in your database.

#### `gram build [pattern]`
Compiles your `.gram` recipes into the final, minified JSON format.
```bash
gram build "**/*.gram" --output ./dist
gram build brioche.gram --pretty
```
- By default, outputs pure JSON directly to `stdout` for easy piping.
- Computes nutritional data and physical mass normalization automatically via the database.

#### `gram view <file>`
Displays a recipe directly in the terminal in a beautifully styled ASCII box.
- Supports automatic paging for long recipes.
- Displays calculated nutrition, timings, and ingredient checklists.
- Options: `--no-pager`, `--skip-db`, `--db`.

#### `gram import <source>`
Imports a recipe from a JSON-LD file or URL and converts it to a `.gram` file using AI.
- Automatically extracts `application/ld+json` from websites.
- Translates and formats the recipe into valid Gram syntax, respecting the `language` config.
- Requires AI to be configured (see `config.yaml`).
- Options: `--output <file>`.

#### `gram shop [pattern]`
Generates an aggregated shopping list across multiple recipes.
- Aggregates quantities intelligently via density.
- Groups ingredients by their `category` field (culinary family: Vegetables, Dairy, Grains, etc.).
- Formats: `--format terminal|md|json`.

### Database Management

Commands nested under `gram db` to manage your `ingredients.yaml`.

#### `gram db sync [pattern]`
Scans your recipes to find undocumented ingredients and adds them to your database.
- Interactive fuzzy matching (Levenshtein) helps you avoid duplicates for plurals or typos.
- Options: `--dry-run`, `--db`.

#### `gram db validate`
Validates the integrity of your `ingredients.yaml`.
- Checks for schema errors, duplicated aliases, and incoherent values (e.g., density > 2.5).
- Warns about missing nutrition or density data.
- Options: `--strict` (exit 1 on warnings).

#### `gram db enrich`
Uses AI to automatically complete missing data in your database.
- Enriches `density`, `unit_weight`, `nutrition`, `category`, and `tags` fields in batches.
- `category` is a culinary family (e.g. Vegetables, Dairy, Grains) — distinct from free-form `tags`.
- Options: `--field density|nutrition|tags|category|all`, `--ingredient <id>`, `--dry-run`.

#### `gram db lint`
Uses AI to detect and resolve semantic duplicates and plurals in your database.
- Detects cross-language duplicates (e.g. `sucre` / `sugar`) and plural forms (e.g. `eggs` → `oeuf`).
- For each duplicate, lets you choose which key to keep — the removed key is automatically added as an alias.
- Displays a nutrition diff (only differing fields) when both entries have conflicting nutrition data, so you can make an informed choice.
- Options: `--report` (show issues without fixing).

---

## Configuration

The CLI merges configuration from `~/.config/gram/config.yaml` (global) and `.gram/config.yaml` (project).

You can also manually override the database path during commands:
```bash
gram build --db ./my-custom-db.yaml
```

### Cascading AI Configuration
GRAM uses a cascading fallback hierarchy for sensitive credentials like AI API keys:
1. **Environment Variables**: Variables like `GEMINI_API_KEY` (from the system or a `.env` file) take absolute precedence. This is the **recommended** way to store secrets locally and in CI/CD environments.
2. **`config.yaml` Fallback**: If the environment variable is missing, GRAM falls back to the `ai.apiKey` field in your `config.yaml`. 

> [!WARNING]
> Storing your `apiKey` in `config.yaml` is highly discouraged if you version control your `.gram` directory with Git, as it will expose your secret key.

### `config.yaml` Settings

Here is the complete reference of all available settings in `config.yaml`:

```yaml
version: 1
database: "./ingredients.yaml" # Relative or absolute path to the database
language: "en"                 # Language for all AI-generated content (categories, tags, imported recipes)
                               # Supported: en, fr, de, es, it, pt, nl, ja, zh — default: en

# AI settings for `gram import`, `gram db enrich` and `gram db lint`
ai:
  # Supported providers: "google", "openai", "anthropic", "ollama"
  provider: "google"
  
  # Specific model string (defaults to 'gemini-3.5-flash' for google)
  model: "gemini-3.5-flash"
  
  # API key (Can also use ENV variables like GEMINI_API_KEY, OPENAI_API_KEY)
  # WARNING: Prefer using a .env file instead of committing this file with your key.
  apiKey: "YOUR_API_KEY"
  
  # Custom base URL (Useful for Ollama or OpenAI compatible proxies)
  baseUrl: "http://localhost:11434"
```

# Command Line Interface (CLI)

The official GRAM CLI (`@gram/cli`) is the primary tool for validating, compiling, and managing your recipe collections locally. It acts as the bridge between your `.gram` files and the rest of your technical stack (SSG, Next.js, mobile apps, etc.).

## Installation

The CLI can be installed globally or locally in your project:

```bash
bun add -d @gram/cli
```

---

## Core Commands

### Project Management & Developer Workflow

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
gram build brioche.gram --scale 2 --output ./dist-doubled
```
- By default, outputs pure JSON directly to `stdout` for easy piping.
- Computes nutritional data and physical mass normalization automatically via the database.
- `--scale <factor>` bakes the scaling into the JSON output (factor only — no ref mode for multi-file builds).

#### `gram view <file>`
Displays a recipe directly in the terminal in a beautifully styled ASCII box.
```bash
gram view brioche.gram                      # Default view
gram view brioche.gram --scale 2            # View at double quantities
gram view brioche.gram --scale farine=300g  # View scaled to flour = 300g
```
- Supports automatic paging for long recipes.
- Displays calculated nutrition, timings, and ingredient checklists.
- With `--scale`, all ingredient quantities (shopping list and in-step references) are adjusted.
- Options: `--scale <factor|ref>`, `--no-pager`, `--skip-db`, `--db`.

#### `gram import <source>`
Imports a recipe from a JSON-LD file or URL and converts it to a `.gram` file using AI.
- Automatically extracts `application/ld+json` from websites.
- Translates and formats the recipe into valid Gram syntax, respecting the `language` config.
- Requires AI to be configured (see `config.yaml`).
- Options: `--output <file>`.

#### `gram shop [pattern]`
Generates an aggregated shopping list across multiple recipes.
```bash
gram shop "**/*.gram"                 # All recipes
gram shop brioche.gram --scale 2      # Double all quantities
gram shop "menus/*.gram" --scale 4    # Batch cooking × 4
```
- Aggregates quantities intelligently via density.
- Groups ingredients by their `category` field (culinary family: Vegetables, Dairy, Grains, etc.).
- `--scale <factor>` applies a numeric multiplier to all recipes (factor only — ref mode not available for multi-file).
- Formats: `--format terminal|md|json`.

#### `gram cook <file>`
Launches an interactive step-by-step cooking guide directly in the terminal.
```bash
gram cook brioche.gram
gram cook carbonara.gram --skip-db
```
**Flow:**
1. **Mise en place** — global ingredient list for the full recipe (Space to start)
2. **Section intro** — ingredients for the upcoming section (shown before each section)
3. **Cooking steps** — one step at a time with inline ingredients, action verb, and instructions
4. **End screen** — total time spent

**Timers** — timers annotated in the recipe (`~label{30min}`) appear in the step view:
- Press `T` to start a timer; if multiple are available, a picker appears
- Timers run in the background — they remain visible as you advance through steps
- A terminal bell sounds and the timer flashes green when it finishes
- Press any key to dismiss a finished timer

**Keyboard shortcuts:**
| Key | Action |
|---|---|
| `Space` / `Enter` | Next step |
| `B` | Previous step |
| `T` | Start a timer |
| `Q` / `Esc` | Quit (asks for confirmation if a timer is running) |

- Options: `--scale <factor|ref>`, `--skip-db`, `--db`.

#### `gram diff <file> [file-b]`
Shows a semantic diff of a recipe — comparing ingredients, timings, and sections rather than raw text.
```bash
gram diff brioche.gram                        # Working tree vs HEAD (most common)
gram diff brioche.gram --ref HEAD~2           # vs a specific git commit
gram diff brioche.gram --ref v1.2             # vs a git tag
gram diff brioche-v1.gram brioche-v2.gram     # Two explicit files (no git needed)
```
Output example:
```
  Semantic diff: brioche.gram (HEAD → working tree)

  INGREDIENTS
  ~ farine             500g → 600g   (+20%)
  + levure             5g
  - sel                2g

  TIMING
  ~ Total time         60 min → 90 min  (+30 min)

  SECTIONS
  ~ Section "Pâte" — 3 → 4 steps (+1)
```
- Operates on compiled objects (Kitchen output), not raw text — syntactic reformatting produces no diff.
- Git mode requires the file to be tracked. Gracefully errors if `git` is unavailable.
- Options: `--ref <git-ref>`.

#### `gram scale <file>`
Displays a before/after comparison of ingredient quantities at a given scale.
```bash
gram scale brioche.gram --scale 2            # Double all quantities
gram scale brioche.gram --scale 0.5          # Halve all quantities
gram scale brioche.gram --scale farine=300g  # Scale so that flour = 300g
gram scale brioche.gram --scale oeufs=3      # Scale so that eggs = 3
```
- Displays a comparison table: original quantities (dimmed) vs scaled (green).
- Quantities that cannot be scaled (text values like "1 pinch") are listed separately.
- Warns on extreme factors (×0.1 or ×20) and notes that cooking times are not adjusted.
- Reference mode (`id=value`) computes the factor from the ingredient's current quantity. The ID must match the ingredient key in the recipe. Units must be compatible (e.g. g↔g) — use `gram db enrich` to add density for volume↔mass conversion.
- Options: `--scale <factor|ref>`, `--skip-db`, `--db`.

#### `gram watch [dir]`
Watches a directory for `.gram` file changes and re-runs `gram check` automatically on every save.
```bash
gram watch                              # Watch project root
gram watch recipes/                     # Watch a specific directory
gram watch --build --output ./dist      # Also build changed files to JSON
```
- Displays a timestamped result line per change: `[12:34:01] ✓ brioche.gram` or `✗ brioche.gram — 1 error`.
- Errors are shown inline below the filename — the watcher never stops on error.
- 150ms debounce prevents redundant runs when editors write files in multiple chunks.
- Options: `--build`, `--output <dir>`, `--skip-db`, `--db`.

#### `gram export <file>`
Exports a recipe to Markdown or print-ready HTML.
```bash
gram export brioche.gram --format md                   # brioche.md alongside the source
gram export brioche.gram --format html -o ~/print.html # explicit output path
gram export brioche.gram --format html --scale 2       # export at double quantities
```
- `--format md` — standard Markdown with a shopping list, equipment section, and numbered steps.
- `--format html` — standalone A4-ready HTML document with embedded CSS for printing. No external dependencies or CDN — works offline and in browser print dialogs.
- Default output path: same directory as the input file, extension replaced (`.gram` → `.md` or `.html`).
- Options: `--format md|html`, `--output <path>`, `--scale <factor|ref>`, `--skip-db`, `--db`.

#### `gram format [pattern]`
Auto-formats `.gram` files applying 9 text-based rules in-place.
```bash
gram format                              # Format all *.gram files
gram format brioche.gram                 # Format a single file
gram format "recipes/**/*.gram" --check  # CI check — exit 1 if any file needs formatting
```
**Rules applied (in order):**
1. **Lowercase ingredient IDs** — `@Farine` → `@farine`
2. **Space before brace** — `@ing {10g}` → `@ing{10g}`
3. **Spaces inside braces** — `@ing{ 10g }` → `@ing{10g}`
4. **Trailing decimal zeros** — `{500.0g}` → `{500g}`, `{1.50g}` → `{1.5g}`
5. **Temperature spacing** — `{180 °C}` → `{180°C}`
6. **Max 2 consecutive blank lines** — collapse runs of 4+ newlines to 3
7. **2 blank lines before section headers** — normalize `##` spacing
8. **Trailing whitespace** — strip end-of-line spaces and tabs
9. **Single newline at EOF**

Output per file: `✔ brioche.gram  2 IDs lowercased · 1 trailing zero removed`
The formatter is idempotent — running it twice produces no further changes.
- Options: `--check`.

### Configuration

Commands nested under `gram config` to read and write project (or global) configuration.

#### `gram config list`
Displays all configuration values from both the local project config and the global config.
```bash
gram config list
```
Output example:
```
  Local config  (.gram/config.yaml)
  ───────────────────────────────────────
  database     ./ingredients.yaml
  language     fr
  ai.provider  google
  ai.model     gemini-2.0-flash
  ai.apiKey    *** (GEMINI_API_KEY in .env)

  Global config  (~/.config/gram/config.yaml)
  ────────────────────────────────────────────
  (empty)
```
- Sensitive values (API keys) are always masked and shown with the env var name they live in.

#### `gram config get <key>`
Prints a single config value to stdout.
```bash
gram config get ai.provider      # → google
gram config get database         # → ./ingredients.yaml
gram config get ai.provider --global
```
- Exits with code 1 if the key is not set.
- Output is plain text, suitable for scripting.

#### `gram config set <key> <value>`
Sets a configuration value.
```bash
gram config set database ./my-db.yaml
gram config set language fr
gram config set ai.provider google
gram config set ai.model gemini-2.0-flash
gram config set ai.apiKey AIza...           # Writes GEMINI_API_KEY to .env
gram config set database ./global-db.yaml --global
```
- Values are written to `.gram/config.yaml` by default; use `--global` for `~/.config/gram/config.yaml`.
- Sensitive keys (`ai.apiKey`) are always written to the project `.env` file. The env var name is derived from the configured provider (e.g. `google` → `GEMINI_API_KEY`).
- Numbers and booleans are coerced automatically (`"2"` → `2`, `"true"` → `true`).

#### `gram config unset <key>`
Removes a configuration value.
```bash
gram config unset ai.model
gram config unset ai.apiKey         # Removes the API key env var from .env
gram config unset language --global
```
- Exits with code 1 if the key was not set.

---

### Database Management

Commands nested under `gram db` to manage your `ingredients.yaml`.

> **Recommended workflow — always run in this order:**
> ```
> gram db sync → gram db lint → gram db enrich
> ```
> Running `lint` before `enrich` avoids wasting AI calls enriching ingredients that will later be merged as duplicates.

#### `gram db sync [pattern]`
**Step 1/3.** Scans your recipes to find undocumented ingredients and adds them to your database.
- Interactive fuzzy matching (Levenshtein) helps you avoid duplicates for plurals or typos.
- Options: `--dry-run`, `--db`.

#### `gram db lint`
**Step 2/3.** Uses AI to detect and resolve semantic duplicates and plurals in your database.
- Detects cross-language duplicates (e.g. `sucre` / `sugar`) and plural forms (e.g. `eggs` → `egg`).
- For each duplicate, lets you choose which key to keep — the removed key is automatically added as an alias.
- Displays a nutrition diff (only differing fields) when both entries have conflicting nutrition data, so you can make an informed choice.
- Options: `--report` (show issues without fixing).

#### `gram db enrich`
**Step 3/3.** Uses AI to automatically complete missing data in your database.
- Enriches `density`, `unit_weight`, `nutrition`, `category`, and `tags` fields in batches.
- `category` is a culinary family (e.g. Vegetables, Dairy, Grains) — distinct from free-form `tags`.
- Idempotent: safely re-runnable, only fills in fields that are still missing.
- Options: `--field density|nutrition|tags|category|all`, `--ingredient <id>`, `--dry-run`.

#### `gram db validate`
Validates the integrity of your `ingredients.yaml`.
- Checks for schema errors, duplicated aliases, and incoherent values (e.g., density > 2.5).
- Warns about missing nutrition or density data.
- Options: `--strict` (exit 1 on warnings).

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

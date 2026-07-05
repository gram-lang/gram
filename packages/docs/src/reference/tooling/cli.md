# Command Line Interface (CLI)

The official Gram CLI (`@gram/cli`) is the primary tool for validating, compiling, and managing your recipe collections locally. It acts as the bridge between your `.gram` files and the rest of your technical stack (SSG, Next.js, mobile apps, etc.).

## Installation

Gram is not yet published to a package registry. To use the CLI, clone the repository and link it locally with [Bun](https://bun.sh/):

```bash
git clone https://codeberg.org/abiwab/gram.git
cd gram
bun install
cd packages/cli
bun link
```

> [!NOTE]
> Bun is required to build and run the CLI, not just to install dependencies — the compiled binary's shebang targets the Bun runtime directly, and core code paths (glob resolution, opening a browser for `gram print`) call Bun-only runtime APIs with no Node.js fallback. `npm`/`pnpm` are not viable substitutes here.

---

## Core Commands

### Project Management & Developer Workflow

#### `gram init`
Scaffolds a new Gram environment in the current directory.
- Creates a `.gram/` directory.
- Generates a plain, uncommented `config.yaml`.
- Interactively configures your preferred recipe language (currently `en` or `fr`).
- Interactively configures your preferred AI provider and model.
- Generates/updates a `.env` file for your AI API keys.
- Generates a heavily commented starter `ingredients.yaml` ingredient database at `.gram/ingredients.yaml`.
- Generates a `.gitignore` to prevent committing sensitive keys.

#### `gram check [pattern]`
Validates your `.gram` files for syntax errors, structural integrity, and undefined ingredients.
- Runs the OhmJS parser to catch syntax errors.
- Runs the Kitchen compiler to catch structural errors (e.g., cyclic dependencies).
- Connects to your `ingredients.yaml` to warn about ingredients not documented in your database.
- Options: `--db <path>`, `--skip-db`.

#### `gram build [pattern]`
Compiles your `.gram` recipes into the final, minified JSON format.
```bash
gram build "**/*.gram" --output ./dist
gram build brioche.gram --pretty
gram build brioche.gram --scale 2 --output ./dist-doubled
```
- By default, outputs pure JSON directly to `stdout` for easy piping.
- Computes nutritional data and physical mass standardization automatically via the database.
- `--scale <factor>` bakes the scaling into the JSON output. Reference mode (e.g. `flour=300g`) isn't available here by design: `build` can batch multiple files at once, and a reproducible batch output shouldn't depend on reading one specific file's shopping list first. Use `gram view`/`gram scale` to find the factor you want, then pass that numeric factor to `build`.
- Options: `--output/-o <dir>`, `--pretty`, `--scale <factor>`, `--db <path>`, `--skip-db`.

#### `gram view <file>`
Displays a recipe directly in the terminal in a beautifully styled ASCII box.
```bash
gram view brioche.gram                      # Default view
gram view brioche.gram --scale 2            # View at double quantities
gram view brioche.gram --scale flour=300g   # View scaled to flour = 300g
```
- Supports automatic paging for long recipes.
- Displays calculated nutrition, timings, and ingredient checklists.
- With `--scale`, all ingredient quantities (shopping list and in-step references) are adjusted.
- Options: `--scale <factor|ref>`, `--no-pager`, `--skip-db`, `--db`, `--bakers-math`, `--bakers-reference <id>`, `--bakers-math-only`.

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
- Aggregates quantities intelligently via density (volume → grams when density is known).
- Groups ingredients by their `category` field (culinary family: Produce, Dairy, Grains, etc.).
- **Alias grouping**: if two recipes use different names for the same ingredient (e.g. `butter` and `beurre`), they are merged under the canonical key via the database aliases.
- Ingredients without a quantity (e.g. `@salt{}`) are listed alongside their main entry rather than in a separate section.
- Supports small units: `pinch`, `dash`, `drop` (and French variants) are handled without aggregation errors.
- `--scale <factor>` applies a numeric multiplier to all recipes (factor only — ref mode not available for multi-file).
- Options: `--format terminal|md|json`, `--output/-o <file>`, `--scale <factor>`, `--db`, `--skip-db`.

#### `gram cook <file>`
Launches an interactive step-by-step cooking guide directly in the terminal.
```bash
gram cook brioche.gram
gram cook carbonara.gram --skip-db
```
**Flow:**
1. **Mise en place** — full aggregated ingredient list for the recipe (Space to start)
2. **Section intro** — ingredients for the upcoming section (aggregated, shown before each section)
3. **Cooking steps** — one step at a time in a two-column layout: ingredients on the left, instructions on the right
4. **End screen** — total time spent

Ingredients are **aggregated per section**: repeated uses of the same ingredient in a section are grouped into one entry with quantities joined (e.g. `200g butter` + `50g butter` → shown as `200g + 50g butter`, not arithmetically summed). The ingredient panel shows all necessary quantities for that section at a glance.

**Timers** — timers annotated in the recipe (`~label{30min}`) appear in the step view:
- Press `T` to start a timer; if multiple are available, a picker appears
- Timers run in the background — they remain visible as you advance through steps
- A terminal bell sounds and the timer's display switches to a static "done" state when it finishes
- `Q`/`Esc` trigger the quit-confirmation flow rather than dismissing a finished timer

**Keyboard shortcuts:**
| Key | Action |
|---|---|
| `Space` / `Enter` | Next step |
| `B` | Previous step |
| `T` | Start a timer |
| `Q` / `Esc` | Quit (asks for confirmation if a timer is running) |

- Options: `--scale <factor|ref>`, `--skip-db`, `--db`.

#### `gram diff <file> [file-b]`
Shows a semantic diff of a recipe — comparing ingredients, timings, sections, temperatures, timers, and frontmatter rather than raw text.
```bash
gram diff brioche.gram                        # Working tree vs HEAD (most common)
gram diff brioche.gram --ref HEAD~2           # vs a specific git commit
gram diff brioche.gram --ref v1.2             # vs a git tag
gram diff brioche-v1.gram brioche-v2.gram     # Two explicit files (no git needed)
```
The diff covers **six axes**:
- **Ingredients** — added/removed/changed quantities, with `percentChange` when units match.
- **Timings** — `totalTime`, `cookTime`, `activeTime`, `preparationTime` in minutes.
- **Sections** — added/removed sections and step-count changes.
- **Frontmatter** — changes to `portions`, `description`, and other metadata fields. A `title` change is tracked separately and shown as its own line above the frontmatter block.
- **Preparations** — changed preparation modes per ingredient (e.g. "diced" → "sliced").
- **Temperatures & Timers** — added/removed/changed temperature targets and timer durations per section.

- Operates on compiled objects (Kitchen output), not raw text — syntactic reformatting produces no diff.
- Git mode requires the file to be tracked. Gracefully errors if `git` is unavailable.
- Options: `--ref <git-ref>`.

#### `gram scale <file>`
Displays a before/after comparison of ingredient quantities at a given scale.
```bash
gram scale brioche.gram --scale 2            # Double all quantities
gram scale brioche.gram --scale 0.5          # Halve all quantities
gram scale brioche.gram --scale flour=300g   # Scale so that flour = 300g
gram scale brioche.gram --scale eggs=3       # Scale so that eggs = 3
```
- Displays a comparison table: original quantities (dimmed) vs scaled (green).
- Quantities that cannot be scaled (text values like "1 pinch") are listed separately.
- Warns on extreme factors (below ×0.1 or above ×20) and notes that cooking times are not adjusted.
- Reference mode (`id=value`) computes the factor from the ingredient's current quantity. The ID must match the ingredient key in the recipe. Units in the same family convert automatically (e.g. `flour=1kg` against a recipe written in `500g`); crossing mass↔volume (e.g. `water=150g` against a recipe in `ml`) also works whenever a density is available — from `gram db enrich`, or a `densities: ["water:1.0"]` override in the recipe's own frontmatter.
- Not every ingredient can be a reference target: fixed (`@=`) ingredients, relative quantities (`70% @&flour`), ingredients only used inside a sub-recipe (their composite parent's own total is a valid target instead), ingredients inside an alternative group, and ingredients split across incompatible units are all rejected with a specific error explaining why (and what to scale by instead). See [Deep Dive: Scaling](/explanation/scaling) for the full list.
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
- Options: `--build`, `--output/-o <dir>`, `--skip-db`, `--db`.

#### `gram suggest`
Finds recipes in your project that use a given set of ingredients.
```bash
gram suggest --with "butter, eggs"
gram suggest --with "chicken" --without "cream"
gram suggest --with "lemon, garlic" --top 5 --min-match 50
gram suggest --with "beurre" --json           # alias-aware: beurre → butter
```
- Scans all `.gram` files in parallel — uses only the parser (no full pipeline compilation), so it is fast even on large collections.
- **Alias-aware matching**: if a database is configured, ingredient names are resolved through the alias index. Searching for `"beurre"` will match recipes containing `@butter`.
- Scores each recipe by match percentage (`matched / total with-terms`). Use `--min-match` to filter low-score results.
- `--without` immediately excludes any recipe that contains one of those ingredients.
- Options: `--with/-w <csv>`, `--without <csv>`, `--top/-n <n>` (default 10), `--min-match <0–100>` (default 1), `--pattern <glob>`, `--db`, `--skip-db`, `--json`.

#### `gram print <file>`
Generates a print-ready HTML and opens it in the default browser.
```bash
gram print brioche.gram                   # Generate and open
gram print brioche.gram --scale 2         # Print at double quantities
gram print brioche.gram --no-open         # Generate only, print the path to stdout
```
- The HTML is written to a temporary file (`gram_print_<timestamp>.html` in the OS temp directory, e.g. `/tmp` on Linux/macOS) and opened with the OS default browser (`open` on macOS, `xdg-open` on Linux, `cmd /c start` on Windows).
- Identical output to `gram export --format html` — suitable for browser print dialog (`Ctrl+P` / `Cmd+P`) to produce an A4 PDF.
- `--no-step-qty` — hides ingredient quantities in step text (useful when cooking from the ingredient list in the margin).
- Options: `--no-open`, `--scale <factor|ref>`, `--no-step-qty`, `--skip-db`, `--db`, `--bakers-math`, `--bakers-reference <id>`, `--bakers-math-only`.

#### `gram export <file>`
Exports a recipe to Markdown or print-ready HTML.
```bash
gram export brioche.gram --format md                   # brioche.md alongside the source
gram export brioche.gram --format html -o ~/print.html # explicit output path
gram export brioche.gram --format html --scale 2       # export at double quantities
```
- `--format md` — standard Markdown with a shopping list, equipment section, and numbered steps.
- `--format html` — standalone A4-ready HTML document with embedded CSS for printing, with inline Lucide SVG icons for timers and temperatures (no external dependency there). It does load Courier Prime (body) and Inter (labels) from Google Fonts via a CSS `@import`, so it is not fully offline-capable — a network connection is needed the first time fonts are fetched.
- Default output path: same directory as the input file, extension replaced (`.gram` → `.md` or `.html`).
- `--no-step-qty` — hides ingredient quantities in step text. **HTML format only** — has no effect with `--format md`. The section mise en place (ingredient list before each section) always shows full quantities.
- Options: `--format md|html`, `--output <path>`, `--scale <factor|ref>`, `--no-step-qty`, `--skip-db`, `--db`, `--bakers-math`, `--bakers-reference <id>`, `--bakers-math-only`.

#### `gram format [pattern]`
Auto-formats `.gram` files applying 9 text-based rules in-place.
```bash
gram format                              # Format all *.gram files
gram format brioche.gram                 # Format a single file
gram format "recipes/**/*.gram" --check  # CI check — exit 1 if any file needs formatting
```
**Rules applied (in this execution order):**
1. **Lowercase ingredient IDs** — `@Flour` → `@flour`
2. **Space before brace** — `@ing {10g}` → `@ing{10g}`
3. **Spaces inside braces** — `@ing{ 10g }` → `@ing{10g}`
4. **Trailing decimal zeros** — `{500.0g}` → `{500g}`, `{1.50g}` → `{1.5g}`
5. **Temperature spacing** — `{180 °C}` → `{180°C}`
6. **Trailing whitespace** — strip end-of-line spaces and tabs
7. **Max 2 consecutive blank lines** — collapse runs of 4+ newlines to 3
8. **2 blank lines before section headers** — normalize `##` spacing
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

#### `gram config get <key>`
Prints a single config value to stdout.
```bash
gram config get ai.provider      # → google
gram config get database         # → .gram/ingredients.yaml
gram config get ai.provider --global
```

#### `gram config set <key> <value>`
Sets a configuration value.
```bash
gram config set database ./my-db.yaml
gram config set ai.provider google
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
```

---

### Database Management

Commands nested under `gram db` to manage your `ingredients.yaml`.

::: tip Recommended Workflow
Always run in this order:
```
gram db sync → gram db lint → gram db enrich
```
Running `lint` before `enrich` avoids wasting AI calls enriching ingredients that will later be merged as duplicates.
Use `gram db search` at any time to inspect entries and audit completeness. Use `gram db merge` to incorporate an external database into your own.
:::

#### `gram db sync [pattern]`
**Step 1/3.** Scans your recipes to find undocumented ingredients and adds them to your database.
- Interactive fuzzy matching (Levenshtein) helps you avoid duplicates for plurals or typos.
- Options: `--dry-run/-n` (preview without writing), `--db <path>`.

#### `gram db lint`
**Step 2/3.** Uses AI to detect and resolve semantic duplicates and plurals in your database.
- Detects cross-language duplicates (e.g. `sucre` / `sugar`) and plural forms (e.g. `eggs` → `egg`).
- For each duplicate, lets you choose which key to keep — the removed key is automatically added as an alias.
- Displays a nutrition diff (only differing fields) when both entries have conflicting nutrition data, so you can make an informed choice.
- Options: `--report/-r` (show issues without applying fixes), `--db <path>`.

#### `gram db enrich`
**Step 3/3.** Uses AI to automatically complete missing data in your database.
- Enriches `density`, `unit_weight`, `nutrition`, `category`, and `tags` fields in batches (`unit_weight` is filled alongside `density`).
- `category` is a culinary family (e.g. Vegetables, Dairy, Grains) — distinct from free-form `tags`.
- Idempotent: safely re-runnable, only fills in fields that are still missing.
- Options: `--ingredient <slug>` (enrich a single entry), `--field density|nutrition|tags|category|all` (default `all`), `--dry-run/-n`, `--db <path>`.

#### `gram db validate`
Validates the integrity of your `ingredients.yaml`.
- Checks for schema errors, duplicated aliases, and incoherent values (e.g., density > 2.5).
- Options: `--strict` (exit 1 on warnings, useful in CI).

#### `gram db search [query]`
Searches and displays ingredient entries in full detail.
```bash
gram db search butter            # Partial match on id, name, or any alias
gram db search --tag dairy       # All dairy-tagged ingredients
gram db search --category Grains # All ingredients in the Grains category
gram db search --missing nutrition  # Entries that have no nutrition data yet
gram db search --exact butter --count  # Print only the match count
```
Every field is displayed for each match: name, aliases, tags, category, and full nutrition (calories, protein, carbs, fat, saturated/monounsaturated/polyunsaturated fat, sugar, fiber, sodium, alcohol per 100g) and physical data (density, yield, unit weight).
- Options: `--tag <tag>`, `--category/-c <category>`, `--missing nutrition|physical|aliases`, `--exact`, `--count`, `--json`, `--db <path>`.

#### `gram db merge <source.yaml>`
Merges an external ingredient database into your local one.
```bash
gram db merge ~/shared-ingredients.yaml          # Interactive conflict resolution
gram db merge community.yaml --prefer remote     # Always use remote values on conflict
gram db merge community.yaml --only-new          # Only add new entries, skip conflict resolution
```
The merge is **alias-aware**: if your database has `butter` with alias `beurre`, and the source has a `beurre` entry, they are recognized as the same ingredient.
- Options: `--prefer local|remote` (default `local`), `--dry-run`, `--only-new`, `--db <path>`.

---

## Configuration File Details

The CLI merges configuration from `~/.config/gram/config.yaml` (global) and `.gram/config.yaml` (project).

### Cascading AI Configuration
Gram uses a cascading fallback hierarchy for sensitive credentials like AI API keys:
1. **Environment Variables**: Variables like `GEMINI_API_KEY` (from the system or a `.env` file) take absolute precedence. This is the **recommended** way to store secrets locally and in CI/CD environments.
2. **`config.yaml` Fallback**: If the environment variable is missing, Gram falls back to the `ai.apiKey` field in your `config.yaml`. 

::: warning Protect your Keys!
Storing your `apiKey` in `config.yaml` is highly discouraged if you version control your `.gram` directory with Git, as it will expose your secret key.
:::

### `config.yaml` Settings

Here is the complete reference of all available settings in `config.yaml`:

```yaml
version: 1                     # Reserved for future config migrations — currently unused by the CLI
database: ".gram/ingredients.yaml" # Relative or absolute path to the database
language: "en"                 # Language for all AI-generated content (categories, tags, imported recipes)
                               # Supported: en, fr, de, es, it, pt, nl, ja, zh — default: en
                               # (the `gram init` interactive prompt currently only offers en/fr;
                               # other codes must be set manually with `gram config set language <code>`)

# AI settings for `gram import`, `gram db enrich` and `gram db lint`
ai:
  # Supported providers: "google", "openai", "anthropic", "ollama"
  provider: "google"
  
  # Specific model string (defaults to 'gemini-3.5-flash' for google,
  # 'gpt-4.1-nano' for openai, 'claude-haiku-4-5-20251001' for anthropic, 'llama4' for ollama)
  model: "gemini-3.5-flash"
  
  # API key (Can also use ENV variables: GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY —
  # for any other/custom provider name, GRAM_API_KEY is used as a generic fallback.
  # Note: the "ollama" provider does not read an API key at all, from config or env.)
  # WARNING: Prefer using a .env file instead of committing this file with your key.
  apiKey: "YOUR_API_KEY"
  
  # Custom base URL — only read for the "ollama" provider (ignored for openai/anthropic/google).
  # Defaults to "http://localhost:11434/v1" (or the OLLAMA_BASE_URL env var) when unset.
  baseUrl: "http://localhost:11434/v1"
```

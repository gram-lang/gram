---
"gram-lang": minor
"@gram-lang/language-server": minor
"@gram-lang/docs": minor
"@gram-lang/analyzer": minor
"@gram-lang/kitchen": minor
"@gram-lang/renderer": minor
"@gram-lang/parser": minor
"@gram-lang/i18n": minor
---

Complete overhaul of the VS Code Extension with Language Server, Live Preview, and advanced assistance

**Major New Features:**
- **Full Language Server (LSP)**: The extension now ships with a complete language server. All advanced features activate instantly upon opening a `.gram` file.
- **Dynamic Live Preview**: A side-by-side WebView panel displaying the real-time HTML render of the recipe as you type.
  - Gracefully handles syntax errors via a visual fallback.
  - Integrates the official Playground styles for perfect consistency.
- **CodeLens & Inlay Hints**:
  - **Inlay Hints**: Displays the cumulative total time in gray next to section titles.
  - **CodeLens**: Clickable buttons `▶ Preview` and `📊 Macros` above the main recipe title for quick access.

**Ingredient Database & Nutrition:**
- **Automatic Loading**: Automatically detects and loads `.gram/ingredients.yaml` from the workspace root (or via the path configured in `gram.ingredientDatabase.path` settings). Optimized indexing (O(1)) for maximum performance.
- **Seamless Plural Management**: The extension silently handles plurals (e.g., `@carrots{3}` will automatically match `carrot`). No error diagnostics are raised, everything is transparent.
- **Nutritional Hover & Macros Panel**:
  - Hovering over an ingredient displays a complete nutritional table (calories, proteins, carbs, fats, etc.).
  - The Live Preview integrates a Macros panel (hidden by default) that can be shown via CodeLens, featuring clear visual alerts for ingredients missing data.
- **Fuzzy Matching "Did you mean?"**: Levenshtein algorithm (distance ≤ 2) suggests corrections if an ingredient is misspelled (e.g., `@tomaato` suggests `@tomato`). Directly integrated into Quick Fix code actions.
- **On-Hover Unit Conversion**: Automatically converts volumes (ml, tbsp, etc.) to grams when hovering over an ingredient if its density is known in the database.

**Editing Assistance & Navigation:**
- **Advanced Contextual Autocompletion**:
  - After `@`: Suggests ingredients and their aliases from the YAML database. Automatically adds curly braces `{}` for multi-word names.
  - After `&`: Suggests only the existing intermediate declarations in the document.
  - Inside `{}`: Suggests canonical units (mass, volume, time) and their aliases (French/English) as soon as a digit is typed.
- **Smart Navigation**:
  - **Go to Definition** (`Ctrl+Click` / `F12`) on a `&ref` reference to jump to its `->&ref` declaration.
  - **Find All References** (`Shift+F12`) to list all usages of an intermediate.
  - **Rename Symbol** (`F2`) to atomically rename an intermediate (declaration + references).
  - **Outline Panel** showing the hierarchy of sections and elements, with foldable code in the gutter.
- **Intermediate Hover**: Displays the full text of the step where the intermediate was created.

**Diagnostics & Code Actions (Quick Fixes):**
- **Real-Time Diagnostics**:
  - Red underline for an orphaned `&ref` reference.
  - Warning for an unused `->&ref` declaration.
  - Warning if the frontmatter (title) is missing.
- **Code Actions (💡)**:
  - *Quick Fix*: Insert the missing `title:` in the frontmatter.
  - *Quick Fix*: Remove an unused intermediate declaration.
  - *Quick Fix*: Declare a missing intermediate for an existing reference.
  - *Refactor*: Convert a volume quantity to mass directly in the code.
  - *Refactor*: Replace a misspelled ingredient with the closest Fuzzy match suggestion.

**Semantic Highlighting, Formatting & Snippets:**
- **Semantic Tokens**: Regex-based syntax highlighting (TextMate) is replaced by **AST-driven** highlighting. Offers surgical precision for ingredients, timers, temperatures, comments, and nested units (e.g., precise separation of value and unit in `{10g}`).
- **Auto-formatting (`Alt+Shift+F`)**:
  - Normalization of spaces inside curly braces (`{ 200 g }` → `{200g}`).
  - Normalization of composite ingredients (`@a < @b` → `@a<@b`).
  - Alignment of section titles and tab-to-space conversions.
- **Built-in Snippets**: Keyboard shortcuts for the basic structure (frontmatter, sections, steps), ingredient variants (`@ing`, `@?`, `@-`), cookware (`#cw`), and timers/temperatures.

# VS Code Extension

The official GRAM VS Code extension transforms your editor into a powerful recipe development environment. Powered by the `@gram/language-server`, it offers real-time diagnostics, advanced editing assistance, and dynamic live rendering.

## Core Capabilities

### 1. Dynamic Live Preview & Nutrition
- **Side-by-side Rendering**: As you type, the extension renders your `.gram` file into beautifully styled HTML in a dedicated WebView panel. It uses the official Playground styles, ensuring a 1:1 match with production outputs.
- **Syntax Error Fallbacks**: If your recipe contains severe syntax errors preventing compilation, the preview panel gracefully displays the error message, keeping you informed without crashing.
- **Nutritional Macros**: A dedicated CodeLens button (`📊 Macros`) appears above the recipe title. Clicking it reveals a detailed nutrition panel (calories, proteins, carbs, fats) within the Live Preview. It also flags ingredients missing from the database.

### 2. Smart Ingredient Management
- **Auto-loading Database**: The extension automatically locates your `.gram/ingredients.yaml` file in the workspace root. Alternatively, you can explicitly configure `gram.ingredientDatabase.path` in your VS Code settings.
- **Silent Plural Management**: The extension seamlessly maps plural nouns in your recipe (e.g., `@carrots`) to singular entries in your YAML database (`carrot`), maintaining language naturalness without raising false errors.
- **Fuzzy Matching**: If you misspell an ingredient, a Levenshtein distance algorithm suggests the closest known match via Code Actions (Quick Fixes).
- **Hover Insights**: Hover over any ingredient to see its full nutritional breakdown. If the database specifies a density, the hover also provides real-time volume-to-mass conversions (e.g., `1 tbsp → 15g`).

### 3. Editing Assistance & Navigation
- **Semantic Tokens**: Regex highlighting is replaced with AST-driven semantic highlighting. This ensures that modifiers, nested units, and composite ingredients (`<@`) are colored with surgical precision.
- **Intelligent Autocomplete**:
  - `@` suggests ingredients from your database, automatically appending `{}` for multi-word names.
  - `&` suggests available intermediate declarations (e.g., `->&dough`).
  - `{}` contextually suggests canonical units (mass, volume, time) and their aliases as soon as a digit is typed.
- **Navigation Shortcuts**:
  - `F12` (Go to Definition) jumps from a reference (`&ref`) to its declaration (`->&ref`).
  - `Shift+F12` (Find All References) locates every usage of an intermediate.
  - `F2` (Rename Symbol) atomically renames intermediates across your document.

### 4. Diagnostics & Refactoring
- **Real-Time Validation**: The LSP immediately flags orphaned references, unused declarations, and missing frontmatter fields.
- **Code Actions (Lightbulb)**:
  - Add missing `title:` to the frontmatter.
  - Remove unused intermediate declarations.
  - Declare a missing intermediate for an existing reference.
  - Convert volume quantities to mass directly in your code (if density is known).

### 5. Auto-formatting
Trigger document formatting (`Alt+Shift+F` or `Shift+Option+F` on macOS) to:
- Normalize spacing inside braces (`{ 200 g }` becomes `{200g}`).
- Format composite ingredients cleanly (`@a < @b` becomes `@a<@b`).
- Align section headers and convert tabs to spaces, leaving the YAML frontmatter intact.

## Editor UI Enhancements
- **Inlay Hints**: Displays cumulative elapsed time (in gray text) next to section headers, helping you gauge total preparation durations at a glance.
- **Outline View**: The native VS Code Outline panel populates with a clean hierarchy of your recipe's sections and intermediates, making large documents easy to navigate.
- **Gutter Folding**: Sections and frontmatter blocks can be folded to save screen space.
- **Rich Snippets**: Type shortcuts like `recipe`, `##`, `step`, `@ing`, or `#cw` to rapidly scaffold common recipe structures.

# GRAM Pipeline & Architecture

This document outlines the business logic, parsing rules, and data transformation pipelines required to convert a `.gram` file into structured JSON recipes.

## 1. Global Architecture

The compilation and analysis flow follows a modern, decoupled 4-stage pipeline:

1.  **Parsing (OhmJS) [`@gram/parser`]:** A PEG (Parsing Expression Grammar) parser validates the raw `.gram` text against the official GRAM grammar.
2.  **AST Generation [`@gram/parser`]:** The match tree is traversed to build a strictly typed, naive **Abstract Syntax Tree (AST)**.
3.  **Compilation [`@gram/compiler`]:** The AST is compiled into a structured recipe JSON. It deduplicates ingredients/cookware, tracks timing and Gantt schedules, aggregates the global shopping list, and minifies the output.
4.  **Analysis [`@gram/analyzer`]:** The compiled JSON is enriched with physical properties (mass normalization, yield percentages, portion scaling, and macronutrient estimations) by querying an external database.

[![](https://mermaid.ink/img/pako:eNpdkEtPwzAQhP-KtVfSkMRWXgcEtBVSJahEeiLuwUqWJqJ2ItcRff53nLRUBZ-845lvVj5A0ZQIKay0aCuymHBF7Fng1uQcXKtKkjWdLnDQOCzJaPRwnFdylpEX-yqFPpLMiBX6-aswhWVoxOUZc9aHRIZSKFMXm4s7yN_FN3nKFrfWYLByeOx774tGtvUaNYdLhubjs1SSdyzqFsksm7_dAugfgFBivdujJndkujWo7Ugmz1ccy6dK10X1DweO_Yy6hNToDh2QqKXoRzj0RRxMhRI5pPZaCv3FgauTzbRCfTSN_I3ppltVkH6K9cZOXVsKg5Na9HtdVY2qRD1uOmUgZXRgQHqALaS-z1zmJXFEkzBgXkCZAzsre9T1Qj-OGI2TkMWMnRzYD7WeG8UBDUNKE-qzyI_j0w9chJYC?type=png)]

---

## 2. Parsing Rules

### 2.1. Sectioning Strategy
The parser normalizes the structure regardless of the input format:
*   **Explicit Sections:** Split by `##` headers.
    *   **Retro-Planning:** Headers can optionally include starting offsets (`{T-2d}`).
        *   **Allowed Units:** `d` (days), `h` (hours), `min` or `m` (minutes).
    *   **Intermediate Output:** Headers can define an intermediate preparation (`->&name{}`) capturing the section's result.
    *   **Strict Order:** Must appear exactly as: `## Title` ➡️ `{Retro-Planning}` ➡️ `->&Intermediate`.
        *   `## Dough {T-2h} ->&dough{}` (Valid)
        *   `## Dough ->&dough{} {T-2h}` (Invalid)
*   **Implicit Section:** If no `##` headers are found, the entire body (after frontmatter) is treated as a single "Default Section" (Title: `null`).

### 2.2. The "Block" Concept (Step)
A step is defined by a paragraph (separated by double newlines).
*   An intermediate preparation defined on a step (`->&dough`) applies to **all** ingredients found within that paragraph block.
*   An intermediate preparation defined on a section title (`## Title ->&dough{}`) applies to the entire section.

### 2.3. Token Parsing Priority
To avoid syntax resolution conflicts, inline tokenization enforces this sequence:
1.  **Comments** (`//`, `/* */`) ➡️ Stripped or isolated.
2.  **Action** (`[Action]`) ➡️ Must occupy the absolute beginning of the block.
3.  **Composites/Sources** (`<@parent`) ➡️ Associate passenger ingredients to drivers immediately.
4.  **Aliases** (`@Name[Alias]`) ➡️ Bracketed text immediately following a name.
5.  **Alternatives** (`@A|@B` or `#A|#B`) ➡️ Separator pipe `|`.
6.  **Standard Ingredients/Cookware** (`@`, `#`).
7.  **Cookware Scaling Logic**:
    *   No quantity (`#bowl{}`) ➡️ **Implicit Fixed** (`fixed: true`).
    *   Quantity defined (`#ramekin{4}`) ➡️ **Implicit Scalable** (`fixed: false`).
    *   Explicit Fixed (`#pan{=2}`) ➡️ **Explicit Fixed** (`fixed: true`).

### 2.4. Strict Timer & Temperature Validation
The parser enforces structures to ensure recipe metrics are computable:
*   **Timers (`~{...}`):** Must have an explicit unit. Whitelisted units: `min` (minutes), `h` (hours), `d` (days), `s` (seconds).
*   **Temperatures (`!{...}`):** Supports two formats:
    *   **Exact Temperatures:** Must have a numeric value and an explicit unit (whitelisted units: `°C`, `°F`).
    *   **Semantic Temperatures:** Allows free-text qualitative descriptions (e.g., `low heat`, `froid`, `à ébullition`) inside the braces. Under the hood, these bypass numeric and unit validation and are exported as a flat `text` field in the final JSON.

---

## 3. Data Logic: Compiler Scope (`@gram/compiler`)

**Goal:** Generate pure recipe structural mappings.

*   **No Physical Computations**: The compiler operates strictly on the text and mathematical structure. It does not load database files or perform unit weight scaling (e.g. converting `cup` to grams).
*   **Stack-based Section Ingredient Resolution**: Section ingredients are recorded exactly as typed.
    *   **Modifiers (`@&` Reference):**
        *   If it has a quantity (`@&butter{50g}`): Treat as a new measured amount of an existing ingredient ➡️ **Add to shopping list** and **add to section ingredients**.
        *   If it has NO quantity (`@&butter{}`): Treat as a flow instruction (e.g., "Use the reserved butter") ➡️ **Ignore in shopping list** and **exclude from section ingredients**.
*   **Relative Quantities (`@{20% @target}`)**:
    *   The compiler checks for targets in the current scope, builds dependency links, and tracks formulas dynamically. It does not resolve these to absolute gram values; resolution is deferred to the `@gram/analyzer`.
*   **Cycle Detection**: The compiler runs a DFS cycle detection pass to flag any self-referential or circular relative ingredient definitions.

---

## 4. Data Logic: Analyzer Scope (`@gram/analyzer`)

**Goal:** Resolve physical quantities, scale portions, and estimate nutrition.

*   **Mass Normalization**: Resolves count/volume quantities to grams (`g`) using density and unit weight mappings from the provided database and YAML metadata overrides.
*   **Yield Percentage Calculations**: Adjusts recipe net masses to gross purchasing masses (e.g. peeling waste factors) dynamically.
*   **Nutritional Estimations**: Computes calories and macros per recipe and per portion based onportion headers and ingredient database lookups.
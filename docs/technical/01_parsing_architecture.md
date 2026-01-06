# GRAM Parser Logic & Behavior

This document outlines the business logic, parsing rules, and data transformation algorithms required to convert a `.gram` file into the target JSON structure.

## 1. Global Architecture

The parsing process follows a modern 3-stage pipeline:

1.  **Parsing (OhmJS):** A PEG (Parsing Expression Grammar) based parser validates the input against the `.gram` grammar and generates a match object.
2.  **AST Generation (Semantics):** The match object is traversed to build a clean **Abstract Syntax Tree (AST)**. This step ensures the structure is strictly typed but naive (no logic aggregation).
3.  **Compilation (Compiler):** The AST is passed to the Compiler which:
    *   Builds the unique registry of ingredients/cookware.
    *   Processes Sections/Steps (Local Scope).
    *   Generated the Global Shopping List (Global Scope aggregation).
    *   Minifies the output for JSON consumption.

### Architecture Diagram

[![](https://mermaid.ink/img/pako:eNp9U2FvmzAQ_SuWP0yplmaFJi1BUyVKaJYpCQzIh21MkRuuxBrYzJhtWZT_Phsasqjb_AH5zLt3797Ze7zhKWAbP-X8x2ZLhETxJGFIrdkyWMWfEzzIBCnQA80hwV_Q5eUdCpzQC3sBERVlGXqFnChGU2AgiKScXbTpDaiBu_4imM29cO_yolQ04pCwFlPVj4q83HYQpOodUSigJeSU6bItXK-UCtjoMii-P52G3nQWxeFHlR5CRispdui-pnkK4u2juOutGP1WA5pNqoszttOukxJ5bjzzl-u57wdaTvRcLhB8A5Xu-IxBryj2grXqN_JCnSChRM_mvICG3nwdelGjM1d2fQf0Qe5QCBXPa13nJbn7zpus5i31Zgtprb3pTQmT8kI352w0zZuYS5KjmBbnfgFL_9auM50qz5zYb2i3vCz1KOfKOeRkmYCMSN5atwCRgRpyVBfn3gWh6tp15q5iCITqWddGXiVp0SXfkwrQa7SqSAb_cv44u-au_On-CXI2Ew07yf8PqBPYYhon2m133TTsfeQvVQsPlCn_dID8Wpa17OTqL-7jTNAU21LU0McFiILoEO_13wTLLWjjbbVNifia4IQdVE5J2CfOi2Oa4HW2xfYTySsV1WVKJEwo0Q-sOxVKJwiX10xi27wxGxJs7_FPbBvj0cC0DMsYjm5HKrju4506NY2BZQ3HhmUapjW-ujEPffyrKXs1sIaGNbKGw_H1eGzdDkd9DClV41m0z755_YffDeYtUg?type=png)](https://mermaid.live/edit#pako:eNp9U2FvmzAQ_SuWP0yplmaFJi1BUyVKaJYpCQzIh21MkRuuxBrYzJhtWZT_Phsasqjb_AH5zLt3797Ze7zhKWAbP-X8x2ZLhETxJGFIrdkyWMWfEzzIBCnQA80hwV_Q5eUdCpzQC3sBERVlGXqFnChGU2AgiKScXbTpDaiBu_4imM29cO_yolQ04pCwFlPVj4q83HYQpOodUSigJeSU6bItXK-UCtjoMii-P52G3nQWxeFHlR5CRispdui-pnkK4u2juOutGP1WA5pNqoszttOukxJ5bjzzl-u57wdaTvRcLhB8A5Xu-IxBryj2grXqN_JCnSChRM_mvICG3nwdelGjM1d2fQf0Qe5QCBXPa13nJbn7zpus5i31Zgtprb3pTQmT8kI352w0zZuYS5KjmBbnfgFL_9auM50qz5zYb2i3vCz1KOfKOeRkmYCMSN5atwCRgRpyVBfn3gWh6tp15q5iCITqWddGXiVp0SXfkwrQa7SqSAb_cv44u-au_On-CXI2Ew07yf8PqBPYYhon2m133TTsfeQvVQsPlCn_dID8Wpa17OTqL-7jTNAU21LU0McFiILoEO_13wTLLWjjbbVNifia4IQdVE5J2CfOi2Oa4HW2xfYTySsV1WVKJEwo0Q-sOxVKJwiX10xi27wxGxJs7_FPbBvj0cC0DMsYjm5HKrju4506NY2BZQ3HhmUapjW-ujEPffyrKXs1sIaGNbKGw_H1eGzdDkd9DClV41m0z755_YffDeYtUg)

---

## 2. Parsing Rules

### 2.1. Sectioning Strategy
The parser must normalize the structure regardless of the input format:
* **Explicit Sections:** If lines starting with `##` are found, split the content based on these headers.
    * **Retro-Planning:** Headers can optionally include timing information (`{T-2d}`).
        * **Allowed Units:** The timing MUST end with one of: `d` (days), `h` (hours), `min` or `m` (minutes).
    * **Intermediate Output:** Headers can define an intermediate preparation (`->&name{}`) which captures the section's result.
    * **Strict Order:** The components MUST appear in this exact order: `## Title` -> `[Retro-Planning]` -> `[Intermediate Output]`.
        * `## Titre {T-2d} ->&pâte{}` (Valid)
        * `## Titre ->&pâte{} {T-2d}` (Invalid)
* **Implicit Section:** If no `##` headers are found, treat the entire body (after metadata) as a single "Default Section" (Title: `null`).

### 2.2. The "Block" Concept (Step)
A step is defined by a paragraph (separated by double newlines).
* **Scope:** Any definition of an intermediate preparation (`->&name`) applies to **all** ingredients found within that paragraph block.
* **Section Scope:** An intermediate preparation defined on a section title (`## Title ->&name{}`) applies to the entire section logic (conceptual encapsulation).

### 2.3. Token parsing order
To avoid conflicts, inline parsing should prioritize:
1.  **Comments** (`//`, `/* */`) -> Remove or extract first.
2.  **Action** (`[Action]`) -> Must be identified at the very start of the block.
3.  **Composites/Sources** (`<@parent`) -> To link the ingredient to its source immediately.
3.  **Aliases** (`@Name[Alias]`) -> Identified by brackets `[]` immediately following the name.
4.  **Alternatives** (`@A|@B` or `#A|#B`) -> Identified by the pipe `|` separating two distinct ingredient or cookware tokens.
5.  **Standard Ingredients/Cookware** (`@`, `#`).
6.  **Cookware Scaling Logic**:
    *   No quantity (`#bowl{}`) -> **Implicit Fixed** (`fixed: true`).
    *   Quantity defined (`#ramekin{4}`) -> **Implicit Scalable** (`fixed: false`).
    *   Explicit Fixed (`#pan{=2}`) -> **Explicit Fixed** (`fixed: true`).

### 2.5. Strict Cookware Validation
*   **Braces `{}`:** Strictly reserved for integer quantities (count). Units or text descriptions inside braces are forbidden.
    *   `#pan{}` (OK - 1 implicit)
    *   `#pan{2}` (OK - 2 pans)
    *   `#pan{20cm}` (INVALID - Parsing error or ignored)
*   **Parentheses `()`:** Used for ALL descriptive attributes (dimensions, material).
    *   `#pan{}(20cm)` (OK)


### 2.4. Strict Unit Validation
The parser **MUST** enforce strict units for Timers and Temperatures to ensure convertibility.

*   **Timers (`~{...}`):**
    *   **Mandatory:** Must have an explicit unit.
    *   **Whitelist:** `min` (minutes), `h` (hours), `d` (days), `s` (seconds).
    *   **Normalization:** `m` or `minutes` should be normalized to `min`.
    *   **Invalid:** Text descriptions or missing units trigger a warning.

*   **Temperatures (`!{...}`):**
    *   **Mandatory:** Must have an explicit unit.
    *   **Whitelist:** `°C` (Celsius), `°F` (Fahrenheit).
    *   **Invalid:** Text descriptions or missing units trigger a warning.

## 3. Data Logic: Section Scope (The "Stack")

**Goal:** Generate `sections[].ingredients`.

* **Rule:** **No Aggregation**. Use a "Stack" logic.
* **Behavior:**
    * If `@butter{100g}` appears in step 1 and `@butter{50g}` in step 3, the section ingredient list MUST contain two distinct entries.
        * **Modifier `@&` (Reference):**
            * **Safety Validated:** The compiler verifies that the referenced ingredient `id` has been seen before. If not -> Warning `UNDEFINED_REFERENCE`.
            * **Instruction Logic:**
                * If it has a quantity (`@&butter{50g}`): Treat as a NEW quantity of an existing item -> **Add to list**.
                * If it has NO quantity (`@&butter{}`): Treat as a flow instruction (e.g. "Use the reserved butter") -> **Ignore in list**.
    * **Relative Quantities (`@{20% @target}` or `@{20% &variable}`)**:
        * **Ingredient Target (`@`)**:
            * Search strictly within the **current section**.
            * Sum the scalar values of all **previous** occurrences of the target ingredient (checking `id`).
        * **Variable Target (`&`)**:
            * Look up the **accumulated mass** of the targeted intermediate variable (calculated at creation `->&`).
        * **Mass Calculation**:
            * All absolute masses are normalized to `g` for calculation.
            * Count/Units (`@egg{1}`) have `mass: 0` but flag the result as `is_partial`.
        * **Formula Tracking**:
            * The compiler attaches a `formula` object to the usage entry.
            * This formula is NOT resolved to a fixed number for the shopping list "Certain Mass". It is kept dynamic for display in the "Variable Parts".
        * **Validation**:
            * Checks for existence of target (Ghost Reference).
            * Checks for self-referential cycles (Circular Reference).
    * **Intermediate Preps:** Ingredients defined via `->&dough{}` or referenced via `@&dough{}` are **never** added to the section's ingredient list (they are internal states, not inputs).
    * **Display References:** References using `&name{qty}` (without `@`) are treated as instruction text elements (`type: 'reference'`). They appear in the step content (with their quantity for display) but do NOT impact the shopping list.

**Output:** `sections[].ingredients` should contain the list of all distinctive ingredient calls found in that section.

---

## 4. Data Logic: Shopping List Scope (The "Aggregator")

The logic for generating the shopping list (Aggregation, Alternatives, Ghost detection...) has been moved to **[Shopping List Generation](../compiler_features/05_shopping_list_logic.md)**.

---

## 5. Output Data Models (JSON Mapping)

The parser generates a **Registry-based** output to minimize redundancy.

### 5.1. The Registry (`registry`)
A central dictionary storing static definitions of ingredients and cookware found in the recipe.
*   **Keys:** Semantic IDs (kebab-case slugs, e.g., `"olive-oil"`).
*   **Values:** Definition objects containing `name`, `default_unit`, `is_composite`, etc.

### 5.2. Minified Usage Objects (`ingredients`, `steps[].content`)
Items in lists are **references** to the registry, containing only dynamic data for that specific usage.

| Field | Description |
| :--- | :--- |
| `id` | The slug referencing the registry entry. |
| `qty` | The numeric value (flattened) or object (if complex). Replaces `quantity`. |
| `unit` | Specific unit for this usage. |
| `modifiers` | Array of modifier flags (`?`, `-`, etc.) if present. |
| `preparation`| String for preparation notes (e.g. "chopped"). |

*Standard `type: "ingredient"` or `type: "single"` properties are removed for brevity.*

### 5.3. Groups (Alternatives)
Alternatives retain a typed structure:
```json
{
  "type": "alternative",
  "options": [ { "id": "milk", "qty": 100 }, { "id": "water", "qty": 100 } ]
}
```

### 5.4. Flag Logic
* **`optional: true`** -> Derived from `@?name`.
* **`hidden: true`** -> Derived from `@-name`.
* **`fixed: true`** -> For cookware, if explicitly fixed (`=`) or implied (no qty).
* **`alias: "String"`** -> Derived from `[Alias]` syntax.

---

## 7. Time Metrics & Scheduling Logic

The logic for calculating active time, total time, and estimating prep time has been moved to **[Time Metrics & Scheduling](../compiler_features/04_time_and_scheduling.md)**.

---

## 8. Edge Cases & Validation

1.  **Unit Conversion:** The parser *should not* attempt to convert units (e.g., tbsp to ml) during parsing. It should store the raw unit. Unit conversion is a display/client-side concern.
2.  **Missing Quantities:**
    * `@salt{}` -> `quantity: 0` (or `null`), `unit: null`.
    * UI should handle `0` as "Quantity Sufficient" (QS) or "to taste".
3.  **Circular References:** The parser should ideally warn if `->&dough{}` is used inside the definition block of `&dough` (though unlikely in a linear recipe).
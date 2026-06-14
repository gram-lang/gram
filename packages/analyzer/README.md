# @gram/analyzer

The physical and nutritional analysis module for the GRAM recipe language. It takes a structurally compiled recipe (produced by `@gram/compiler`) and enriches it with calculated masses, waste yield scaling, and macronutrient estimations based on a provided database.

---

## 📚 General Documentation

For full syntax specifications, grammar details, cheatsheets, and best practices, please refer to the central **[GRAM Documentation Index](../../docs/README.md)**.

---

## 🛠️ Installation

Install `@gram/analyzer` via bun:

```bash
bun install @gram/analyzer
```

---

## ⚡ Usage

```javascript
const { getAST } = require('@gram/parser');
const { compile } = require('@gram/compiler');
const { analyze } = require('@gram/analyzer');

// 1. Compile AST
const ast = getAST("## Salad\nAdd @avocado{1} and @lemon juice{1tbsp}.");
const compiled = compile(ast);

// 2. Define/Load Ingredient Database
const database = {
  "avocado": {
    "name": "avocado",
    "physical": { "unit_weight": 150, "yield": 0.70 } // 30% waste (peel, pit)
  },
  "lemon-juice": {
    "name": "lemon juice",
    "physical": { "density": 1.01 } // 1.01 g/ml
  }
};

// 3. Analyze
const analysisResult = analyze(compiled, database, {
  enableMassNormalization: true,
  enableYieldManagement: true,
  enableNutritionalEstimation: false
});

console.log(analysisResult.result.metrics.totalMass);
console.log(analysisResult.result.shopping_list); // Purchasing mass auto-calculated
```

---

## 🏗️ Structure

*   `src/index.ts`: The main entry point. Orchestrates the enrichment of sections, steps, and shopping lists.
*   `src/mass_normalization.ts`: Resolves count/volume quantities to grams (`g`).
*   `src/yield_management.ts`: Scales ingredient net weights to raw purchase weights.
*   `src/nutrition.ts`: Sums macros and calories per serving.
*   `src/metrics.ts`: Computes global mass metrics and warning outputs.
*   `src/ingredient_db.ts`: Handles database lookup maps.
*   `src/i18n.ts`: Resolves volume unit translations (e.g., càs ➡️ tbsp).

---

## 📄 License

This project is licensed under the GPL-3.0 License.

# @gram-lang/analyzer

[![npm version](https://badge.fury.io/js/@gram-lang%2Fanalyzer.svg)](https://www.npmjs.com/package/@gram-lang/analyzer)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

*Part of the [Gram monorepo](https://git.gram-lang.org/gram-lang/gram).*

The physical and nutritional analysis module for the Gram recipe language. It takes a structurally compiled recipe (produced by `@gram-lang/kitchen`) and enriches it with calculated masses, waste yield scaling, and macronutrient estimations based on a provided database.

---

## 📚 General Documentation

For full syntax specifications, grammar details, cheatsheets, and best practices, please refer to the **[Gram Documentation](https://docs.gram-lang.org/)**.

---

## 🛠️ Installation

```bash
npm install @gram-lang/analyzer
# or
bun add @gram-lang/analyzer
```

---

## ⚡ Usage

```javascript
import { getAST } from '@gram-lang/parser';
import { compile } from '@gram-lang/kitchen';
import { analyze } from '@gram-lang/analyzer';

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
  enableMassStandardization: true,
  enableYieldCalculation: true,
  enableNutritionalEstimation: false
});

console.log(analysisResult.result.metrics.totalMass);
console.log(analysisResult.result.shopping_list); // Purchasing mass auto-calculated
```

---

## 🏗️ Structure

*   `src/index.ts`: The main entry point. Orchestrates the enrichment of sections, steps, and shopping lists.
*   `src/mass_standardization.ts`: Resolves count/volume quantities to grams (`g`), including yield-scaled purchase weights.
*   `src/nutrition.ts`: Sums macros and calories per serving.
*   `src/metrics.ts`: Computes global mass metrics and warning outputs.
*   `src/ingredient_db.ts`: Handles database lookup maps and validation.
*   `src/shopping_aggregation.ts`: Aggregates analyzed quantities into the final shopping list.
*   `src/diff.ts`: Computes semantic diffs between two analyzed recipes.
*   `src/schemas.ts`: Zod schemas for analyzer options and ingredient database entries.

---

## 📄 License

This project is licensed under the GPL-3.0 License.

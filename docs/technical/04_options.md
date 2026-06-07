# Configuration & Options

The GRAM ecosystem is modularly configured using `CompilerOptions` for structural output and `AnalyzerOptions` for physical computations.

---

## 1. Compiler Options (`CompilerOptions`)

`CompilerOptions` configure the core structural compile pipeline (`@gram/compiler`). It is passed as the second argument to `compile`.

```typescript
export interface CompilerOptions {
  // Reserved for future structural compile-time settings
}
```

---

## 2. Analyzer Options (`AnalyzerOptions`)

`AnalyzerOptions` configure the physical and nutritional analysis pipeline (`@gram/analyzer`). It is passed as the third argument to the `analyze` function.

```typescript
export interface AnalyzerOptions {
    /**
     * Enable/Disable physical mass normalization (converting ml, cups, etc. to grams).
     * Default: true
     */
    enableMassNormalization?: boolean;

    /**
     * Enable/Disable Net vs Gross purchasing mass estimations.
     * Requires enableMassNormalization to be true.
     * Default: true
     */
    enableYieldManagement?: boolean;

    /**
     * Enable/Disable calorie and macronutrient estimations.
     * Default: true
     */
    enableNutritionalEstimation?: boolean;

    /**
     * Number of portions to scale nutritional calculations (e.g. per serving).
     * Default: 1
     */
    portions?: number;
}
```

---

## 3. Usage Example

To parse, compile, and physically analyze a recipe in JavaScript/TypeScript:

```typescript
import { getAST } from '@gram/parser';
import { compile } from '@gram/compiler';
import { analyze } from '@gram/analyzer';

// 1. Get raw AST
const ast = getAST(recipeSource);

// 2. Compile structure
const compiled = compile(ast);

// 3. Analyze physical properties (passing database and options)
const database = { /* loaded ingredient database */ };
const analysisResult = analyze(compiled, database, {
    enableMassNormalization: true,
    enableYieldManagement: true,
    enableNutritionalEstimation: true,
    portions: 4
});

console.log(analysisResult.result.metrics.totalMass);
console.log(analysisResult.result.metrics.nutrition);
```

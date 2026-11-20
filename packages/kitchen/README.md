# @gram-lang/kitchen

[![npm](https://img.shields.io/npm/v/@gram-lang/kitchen?color=cb3837&style=flat-square)](https://www.npmjs.com/package/@gram-lang/kitchen)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

*Part of the [Gram monorepo](https://git.gram-lang.org/gram-lang/gram).*

The compiler for the Gram recipe language. It takes a typed Recipe AST (produced by `@gram-lang/parser` or composed by `@gram-lang/modules`) and compiles it into a structured, minified recipe JSON (aggregating shopping lists, processing sections, resolving compound quantities and same-family unit ratios, splitting the mise en place by section, and laying out the task graph and default schedule). The scheduling itself is done by [`@gram-lang/scheduler`](../scheduler/README.md), which kitchen feeds with a neutral list of tasks.

---

## 📚 General Documentation

For full syntax specifications, grammar details, cheatsheets, and best practices, please refer to the **[Gram Documentation](https://gram-lang.org/docs/)**.

---

## 🛠️ Installation

```bash
npm install @gram-lang/kitchen
# or
bun add @gram-lang/kitchen
```

---

## ⚡ Usage

```javascript
import { getAST } from '@gram-lang/parser';
import { compile } from '@gram-lang/kitchen';

const source = `
## My Recipe

[Mix] @flour{200g} and @water{100ml} for ~{5min}.
`;

const ast = getAST(source);
const result = compile(ast);

console.log(result.shopping_list);
console.log(result.schedule.totalTime);  // Default timeline, mise en place right before each section (minutes)
console.log(result.tasks);               // The list of tasks and what each one waits for
console.log(result.miseEnPlace);         // How long each section's own preparation takes

// Any other timeline comes from the same tasks, without compiling again:
// import { layout } from '@gram-lang/scheduler';
// layout(result.tasks, { miseEnPlace: 'upfront', rests: 'longest' });
```

---

## 🏗️ Structure

*   `src/core.ts`: The main compiler entry point (`compile`).
*   `src/processor.ts`: Processes step-by-step block content, local scopes, and timers.
*   `src/section.ts`: Compiles individual recipe sections.
*   `src/shopping.ts`: Deduplicates and aggregates ingredients into a master shopping list.
*   `src/terms.ts`, `src/compound.ts`: Normalizes and evaluates compound quantities (`1 cup + 2 tbsp`).
*   `src/ratio.ts`: Resolves unit ratios (`resolveRatios`) and scales proportional timers.
*   `src/mise-en-place.ts`, `src/metrics.ts`: Split the preparation (ingredients, cookware, intermediates) by section, and compute the preparation time.
*   `src/task-graph.ts`, `src/step-timing.ts`: Builds the list of tasks (steps, timers, preparations) and what each one waits for, handed to the scheduler.
*   `src/schedule-mode.ts`, `src/recompute.ts`: `scheduleFor()`, `scheduleTimes()`, and `recomputeSchedule()` after scaling or ratio resolution.
*   `src/schedule-warnings.ts`, `src/overlap-warnings.ts`: Turn what the scheduler reports (`DAY_OVERFLOW`, track contention...) and passive overlaps on the same cookware (`PASSIVE_OVERLAP_SAME_COOKWARE`) into compiler warnings.
*   `src/legacy-timings.ts`: The deprecated `steps[].timings` and `metrics` time fields, kept until 2.0.0.
*   `src/graph.ts`: Traverses relative quantities and runs cycle detection (DFS).
*   `src/registry.ts`: Tracks declared ingredients, cookware, and references across the recipe.
*   `src/scale/`: Applies scale factors to quantities throughout the compiled recipe.
*   `src/warnings.ts`: Collects non-fatal compilation warnings.
*   `src/schemas.ts`: Zod schemas for compiler options.
*   `src/utils.ts`: Includes helpers for string slugification, minification, and time unit conversions.

---

## 📄 License

This project is licensed under the GPL-3.0 License.

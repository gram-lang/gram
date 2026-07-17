# Times & Scheduling

You can define `~timer` declarations and durations in your recipes using the `~` symbol.

## Basic Declaration

A `~timer` **must** specify a unit inside the braces. Fuzzy text like `~{about 10 minutes}` is invalid.

```gram
Bake for ~{25min}.
```

**Supported units:**
- `min` (minutes) - Preferred standard.
- `h` (hours).
- `d` (days).
- `s` (seconds).

> **Note:** `m` or `minutes` will be automatically corrected to `min` by the compiler.

### Timer Names
You can assign a specific name to a `~timer`. This is especially useful for passive tasks: when multiple `~timer` declarations run in parallel (like a dough resting while a sauce simmers), names allow tools and renderers to clearly identify and track them simultaneously.

```gram
Boil @eggs{2} for ~eggs{3min}.
```

### Ranges
You can specify a time range if the duration is an estimate.

```gram
Bake for ~{30-40min}.
```
::: tip
For global timeline calculations (total recipe duration), the compiler automatically uses the average of the range (here, 35 minutes).
:::

## Active vs Passive

The Gram compiler builds a complete execution timeline (similar to a Gantt chart) of your recipe. To do this accurately, it needs to know if a `~timer` requires your full attention or if it runs in the background.

::: tip 💡 The Golden Rule: Does this step block YOU from starting the next step?

| Your Status | Timer Type | Syntax | Examples |
| :--- | :--- | :--- | :--- |
| **YES** (Manual attention required) | **Active** | `~` | *Whisking by hand, stirring a risotto* |
| **NO** (A machine/time does the work) | **Passive** | `~_` | *Oven baking, resting, stand mixer* |

:::

### Active (Default)
By default, a `~timer` is active. This implies you are actively working and **blocks** the workflow. You must finish this before doing anything else.

```gram
Whisk the @heavy cream{} continuously for ~{5min}.
```
> ⏱️ **Result:** Adds 5 minutes to the **Active Time**.

### Passive (`_`)
Use the `_` modifier to make a `~timer` passive. This is a **background task**. You start the `~timer` (e.g., putting a dish in the oven) and immediately move on to the next step.

```gram
Bake in the #oven for ~_{45min}.

Meanwhile, prepare the glaze...
```
> ⏱️ **Result:** Adds 0 minutes to the Active Time, but ensures the **Cook Time** is extended to cover this 45-minute wait.

## How Time is Calculated

Behind the scenes, Gram computes four distinct time metrics to give you a realistic cooking schedule.

::: info ⏱️ The 4 Time Metrics
1. **Preparation Time** (Mise-en-place): Time needed *before* you start step 1 (gathering ingredients, peeling, chopping).
2. **Active Time**: Time spent actively working during the cooking steps (hands busy).
3. **Cook Time**: The absolute time of the cooking workflow from step 1 to finish (including passive waiting).
4. **Total Time**: The sum of Preparation Time + Cook Time. This is the realistic "time in the kitchen".
:::

### Cheat Sheet: What adds time?

Here is a concrete breakdown of how the compiler automatically calculates minutes based on your syntax:

| Syntax / Scenario | Adds to Prep Time | Adds to Active Time | Adds to Cook Time | Adds to Total Time |
| :--- | :--- | :--- | :--- | :--- |
| **New Ingredient** (`@flour`) | **+ 1 min** | - | - | **+ 1 min** |
| **Prep shorthand** (`@onion(peeled)`) | **+ 2 min** | - | - | **+ 2 min** |
| **Active Timer** (`~{10min}`) | - | **+ 10 min** | **+ 10 min** | **+ 10 min** |
| **Passive Timer** (`~_{1h}`) | - | - | **+ 1 hour** (in background) | **+ 1 hour** |
| **Step without any timer** | - | **+ 2 min** (default fallback) | **+ 2 min** | **+ 2 min** |

### Smart Dependency Tracking
You don't need to do complex math! If you declare a dough that rests for `~_{1h}` in the background, and a later step requires that `&dough`, the compiler automatically "pauses" the timeline and waits for the hour to finish before starting that step.

## Error Handling

The compiler validates `~timer` declarations to ensure precise scheduling and will output specific warnings for malformed data:

- **Missing Unit**: If you write `~{30}` without specifying minutes or hours, the compiler warns `MISSING_UNIT`.
- **Invalid Unit**: If you provide a unit the compiler doesn't understand (e.g., `~{30 lightyears}`), it warns `INVALID_UNIT`.

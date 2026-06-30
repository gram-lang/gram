# Times & Scheduling

You can define timers and durations in your recipes using the `~` symbol.

## Basic Declaration

Timers **must** specify a unit inside the braces. Fuzzy text like `~{about 10 minutes}` is invalid.

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
You can give a specific name to a timer for clarity, or for external applications to use as labels in notifications.

```gram
Boil @eggs{2} for ~eggs{3min}.
```

### Ranges
You can specify a time range if the duration is an estimate.

```gram
Bake for ~{30-40min}.
```

## Synchronous vs Asynchronous

The Gram compiler builds a complete execution timeline (similar to a Gantt chart) of your recipe. Timers directly affect this timeline.

### Synchronous (Default)
By default, timers are synchronous. This means they **block** the workflow. The cook must wait for this timer to finish before proceeding to the next step.

```gram
Simmer the sauce for ~{20min}.
```
*The compiler adds 20 minutes to the total active cooking time.*

### Asynchronous (`&`)
You can use the `&` modifier to make a timer asynchronous. This indicates a background task. The cook starts the timer but can immediately proceed to the next step in the recipe.

```gram
Let the dough rest for ~&{1h}.
Meanwhile, prepare the filling...
```
*The compiler registers this as a background task. It does not add 1 hour to the active cooking time, but it ensures the total recipe time is long enough to cover this background task.*

## How Time is Calculated

Behind the scenes, the Gram Compiler (`@gram/kitchen`) computes three distinct time metrics. Understanding these helps you write more accurate recipes:

::: tip Time Metrics
1. **Active Time (`activeTime`)**: 
   - Sums all synchronous timers.
   - **Fallback**: If a cooking step does *not* contain any timer, the compiler assumes a default active duration of **2 minutes** to execute that step.
2. **Total Time (`totalTime`)**: 
   - The absolute maximum workflow end time, accounting for all overlapping asynchronous background tasks.
3. **Preparation Time (`preparationTime`)**:
   - Calculated entirely independently from timers!
   - Adds **1 minute** of overhead for every unique ingredient and cookware item (gathering the *mise en place*).
   - Adds **2 minutes** for every ingredient that has a shorthand preparation declared (e.g., `@onion{1}(peeled and chopped)` automatically adds 2 minutes of prep time).
:::

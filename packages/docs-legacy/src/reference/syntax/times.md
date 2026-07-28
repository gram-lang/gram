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

These units are resolved through Gram's multi-language time dictionary: the localized aliases below are also recognized for a `~timer`, regardless of the language the recipe is written in (e.g. in a French recipe, `~{2j}` works exactly like `~{2d}`).

<!--@include: ../api/parts/en/time-units.md-->

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

### Sequential Passive Timers (Named Tracks)
By default, passive timers run in parallel with the rest of your recipe. However, some background tasks cannot physically run at the same time (e.g. baking something for 10 minutes, then lowering the temperature and baking it for another 30 minutes). 

If you want passive timers to run **sequentially** (one after the other), simply give them the **same name**:

```gram
Bake in the #oven at 240°C for ~_baking{10min}.

Lower the heat to 180°C and bake for ~_baking{30min}.
```

> ⏱️ **Result:** Because both timers share the name `baking`, Gram places them on the same background track. The 30-minute timer will automatically start *after* the 10-minute timer finishes. The total Cook Time increases by 40 minutes, but your Active Time remains untouched.

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

### Smart Dependency Tracking (ALAP)
You don't need to do complex math! Gram uses an **As Late As Possible (ALAP)** scheduling algorithm. If you declare a dough that rests for `~_{1h}` in the background, and a later step requires that `&dough`, the compiler automatically pushes the dough preparation back as late as possible. The dough will finish resting *exactly* when the later step begins, preventing it from sitting idle on the counter!

For a more detailed explanation of how the timeline is optimized, check out the [ALAP Scheduling Deep Dive](../explanation/alap-scheduling.md).

## Section Retro-Planning

You can assign a preparation offset to a `## Section` by adding a `~{...}` annotation to its title. This allows you to indicate to the compiler when that section must end relative to its final use.

**This acts as a time anchor**. If you add `~{-2d}` to a section, you are telling the compiler to schedule this preparation **2 days before** it is actually needed. 

To ensure the generated timeline remains coherent and all absolute times are positive (starting at `0`), the compiler automatically resets the time calculations (`timings`): this early preparation becomes the new starting point (Time 0) of the recipe, and all subsequent cooking steps are shifted proportionally. It is the perfect tool for managing multi-day recipes while keeping the output data easily consumable by user interfaces.

```gram
## Puff Pastry ~{-2d}
```

This means the "Puff Pastry" section should be prepared **2 days in advance**.

### Strict syntax

Unlike free text, `~{...}` on a section header requires a **strictly negative** signed number followed by a unit — since this annotation is specifically used to indicate how much time *in advance* the section must be prepared, a zero or positive offset has no meaningful interpretation here:

- A **required** leading `-` (anticipation is the whole point of retro-planning).
- A non-zero number.
- A unit: `d` (days), `h` (hours), or `min` (minutes).

```gram
## Puff Pastry ~{-2d}     <!-- 2 days before -->
## Ganache ~{-30min}      <!-- 30 minutes before -->
```

Free text (e.g. `~{the day before}`/`~{la veille}`), an unsigned or positive value (e.g. `~{2h}`), and a zero value (e.g. `~{0h}` or `~{-0h}`) are all **no longer valid** for this annotation — write `~{-1d}` instead. Existing recipes using any of these still compile, but the compiler now flags them as described below.

The unit is resolved through the same multi-language time dictionary used by `~timer` (see [Basic Declaration](#basic-declaration)), so localized words work here too — e.g. in a French recipe, `~{-2j}` resolves the same as `~{-2d}`.

See also: [Retro-planning (Scheduling)](./document-structure.md#retro-planning-scheduling) in the document structure reference.

## Error Handling

The compiler validates `~timer` declarations and section retro-planning annotations to ensure precise scheduling, and will output specific warnings for malformed data:

- **Missing Unit** (`~timer`): If you write `~{30}` without specifying minutes or hours, the compiler warns `MISSING_UNIT`.
- **Invalid Unit** (`~timer`): If you provide a unit the compiler doesn't understand (e.g., `~{30 lightyears}`), it warns `INVALID_UNIT`.
- **Missing Unit** (section retro-planning): `~{-2}`, free text like `~{la veille}`, an unsigned/positive value (`~{2h}`), or a zero value (`~{0h}`, `~{-0h}`) all trigger `MISSING_UNIT` — none of them are a strictly negative signed duration.
- **Invalid Unit** (section retro-planning): an unrecognized unit (e.g. `~{-2fortnights}`) triggers `INVALID_UNIT`.
- **Time Paradox**: If a section retro-planning anchor conflicts with an earlier required dependency (e.g., a section anchored at `-10 min` but used in a section anchored at `-1 h`), the compiler warns `TIME_PARADOX`.
- **Track Contention**: If you use named passive timers (e.g. `~_oven{30min}`) and the ALAP algorithm is forced to delay them due to crowding (multiple timers on the same track at the same time), the compiler warns `TRACK_CONTENTION`.

For section retro-planning, the original annotation is still displayed as-is even when it triggers a warning. In every case, these are non-blocking by default, but are promoted to hard errors by `gram check --strict`.

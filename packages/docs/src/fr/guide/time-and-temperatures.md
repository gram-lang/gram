# Timers (~) and Temperatures (°)

GRAM normalizes time and heat to allow conversions and interactive displays.

## Timers

Trigger: `~`

### Syntax
`~{valueUnit}`

*   **Unit Mandatory.** No fuzzy text.
*   **Supported Units:**
    *   `min`, `m` (minutes) -> Normalized to `min`.
    *   `h` (hours).
    *   `d` (days).
    *   `s` (seconds).

### Examples
*   `~{30min}`
*   `~{1h}`
*   `~{3-4min}` (Time range)

### Named Timer
You can name the timer for the UI (e.g., multiple simultaneous cookings).
The name goes between `~` and the brace.

```gram
Cook eggs ~eggs{3min} and pasta ~pasta{9min}.
```

### Passive Tasks (Idle)
By default, a timer blocks the "Active Time" (the cook is busy). 
To indicate a background task (e.g., baking, rising, marinating) where the cook is free to do other steps, use the `&` modifier right after the tilde (`~&`).

*   `~&{1h}` : Passive (Background/Idle).
*   `~{10m}` : Active (Blocking).

**Example:**
```gram
Knead ~{10min}. Rise ~&{1h}.
```
*   Step 1: 10m active time.
*   Step 2: 0m active time (starts immediately after kneading). Cook is free.

### Default Timings
If a step has **no timers** and is not passive, the compiler assigns a default **2 minutes** active time (reading, mixing, etc.).
Passive steps (`~&{...}`) have **0 active time**.

### Estimated Preparation Time (Mise en Place)
The compiler automatically estimates the "Mise en place" time based on the recipe complexity:
*   **Base**: 1 min per unique ingredient and cookware (weighing, fetching).
*   **Preparation**: +2 min for each ingredient usage with a specific preparation (e.g., `(chopped)`, `(peeled)`).
*   **Alternatives**: Takes the maximum time of possible options.

> **Tip:** Passive timers (`~&`) allow applications to generate automated Gantt charts, calculate total vs. active time, and help the cook identify parallel tasks.

---

## Temperatures

Trigger: `°`

### Syntax

Temperatures support two formats: **Exact Temperatures** and **Semantic Temperatures**.

#### 1. Exact Temperatures
`°{valueUnit}`
*   **Unit Mandatory.**
*   **Supported Units:**
    *   `°C` (Celsius).
    *   `°F` (Fahrenheit).
*   **Examples:**
    *   `°{180°C}`
    *   `°{350°F}`

#### 2. Semantic Temperatures
`°{description}`
*   Allows generic free-text strings of characters inside the brackets for non-numeric contexts (e.g. stove settings, water status).
*   **Examples:**
    *   `°{low heat}`
    *   `°{cold}`
    *   `°{boiling}`

### Named Temperature
You can name the temperature for the UI. The name goes between `°` and the brace.
```gram
Preheat the °oven{180°C}.
Cook on °stove{low heat}.
```

## Best Practices

1.  **Be numeric when possible.** Avoid `~{about 10 minutes}`. Prefer `~{10min}` and add "about" in the surrounding text.
2.  **Ranges.** Use hyphens for uncertainties: `~{15-20min}`.
3.  **Conversions.** The parser does not convert values (C -> F) in the code; it is up to the display engine ("front-end") to offer conversion if the user requests it. GRAM stores the exact raw value.

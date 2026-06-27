# Time Metrics & Scheduling Logic

The compiler goes beyond simple text parsing by performing a simplified **Critical Path Method (CPM)** analysis on your recipe to estimate timing metrics.

## 1. Active vs Total Time

The compiler distinguishes between time you spend working and time you spend waiting.

*   **Active Time**: Time requiring user attention (chopping, stirring).
*   **Total Time**: The total duration from start to finish.

### Calculation Rules

*   **Default Cost**: Any text step without a specific timer costs **2 minutes** of Active Time (reading, mixing, handling).
*   **Synchronous Timer (`~{10m}`)**:
    *   Adds to **Active Time** (assuming you are monitoring/cooking).
    *   Adds to **Total Time**.
    *   *Note: Future versions may allow marking timers as "passive" to reduce Active Time.*
*   **Asynchronous Timer (`~&{1h}`)**:
    *   Declared with the `&` modifier after the `~`.
    *   Adds **0** to Active Time.
    *   Starts a "Background Task" (e.g., rising dough, marinating) that runs parallel to subsequent steps.
    *   **Total Time** is calculated dynamically: `Max(Personal_Cursor, Background_Task_End)`.

## 2. Estimated Preparation Time (Mise en Place)

The compiler generates an automated estimation of the "hidden work" required before cooking starts (chopping, peeling, gathering equipment).

This metric is displayed as **"Prep Time (est.)"**.

**Formula:** `Total Prep = Base Cost + Usage Cost`

1.  **Base Cost:** 
    *   **+1 min** per unique Ingredient in the Registry (gathering items).
    *   **+1 min** per unique Cookware in the Registry (gathering tools).
2.  **Usage Cost:**
    *   Iterates through every step content.
    *   **+2 min** if an ingredient has a specific preparation note (e.g., `(chopped)`, `(diced)`).
3.  **Alternative Rule (Max Strategy):**
    *   In a choice (`@A|@B`), the system calculates the prep cost for each option and takes the **MAXIMUM**.
    *   *Rationale:* We estimate for the "worst case" scenario to ensure the user has enough time.

## 3. Retro-Planning

If you define a retro-planning target in a section header (e.g., `## Dough ~{-2h}`), the compiler can calculate the localized start time for that section relative to the serving time.

*(Note: This feature interacts with the async timer logic to suggest when to start specific sub-sections).*

## 4. Timer Labels in `gram cook`

The `gram cook` interactive TUI exposes all timers defined in a recipe as startable countdown timers. The label displayed in the cooking interface comes directly from the timer's name in the GRAM source:

| GRAM syntax | Timer label in `gram cook` |
|---|---|
| `~repos{45min}` | "repos" |
| `~&cuisson{30min}` | "cuisson" |
| `~{10min}` (no label) | "Timer step N" |

Async timers (`~&`) declared in a step appear in the `backgroundTasks` of the compiled output and continue counting down independently of which step the user is currently viewing — consistent with their semantics in the compiler's CPM analysis.


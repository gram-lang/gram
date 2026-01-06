# Shopping List Generation Logic

The compiler transforms the linear list of ingredients found in steps into a consolidated, intelligent **Shopping List**.

## 1. Aggregation Strategy

The compiler scans the entire recipe (all sections) to gather requirements.

### 1.1. Hybrid Aggregation
Multiple calls for the same ingredient are merged when possible.

*   **Rule**: Merge "Addable" quantities.
*   **Result Structure**:
    *   `[Certain Mass]`: Sum of all absolute, convertible quantities (g, kg, ml -> g).
    *   `[Variable Parts]`: List of all non-additive units (e.g., "1 pinch", "to taste") or relative quantities that couldn't be resolved to a fixed mass.

**Example:**
*   Step 1: `@sugar{100g}`
*   Step 5: `@sugar{50g}`
*   Step 8: `@sugar{1 pinch}`
*   **Result**: Sugar -> `150g + 1 pinch`.

### 1.2. Alternatives Handling
Alternatives (`@butter{}|@oil{}`) are **never merged** with single ingredients. They appear as a distinct "Alternative Group" in the shopping list to force the user to make a choice.

## 2. Advanced Resolution

### 2.1. Ghost References
If an ingredient uses a relative quantity (`@{50% @milk}`) but `@milk{}` is never defined in previous steps, the compiler flags this as a **Ghost Reference** (`❓ Source not found`).

### 2.2. Circular References
The compiler detects infinite loops (A depends on B, B depends on A) and flags them as `⚠️ Circular Ref` instead of crashing.

### 2.3. Composite Ingredients (Max Rule)
For "Driver/Passenger" ingredients (`<@parent{}`), the compiler applies a **MAX** strategy.

*   If Step A needs 1 lemon's zest.
*   If Step B needs 3 lemons' juice.
*   The Shopping List will request **3 Lemons** (the driver), ensuring coverage for the highest requirement.

## 3. Flow Instructions
Ingredients defined with empty quantities (e.g., `@reserved_sauce{}`) are treated as **Flow Instructions** (referring to something already made) and are **excluded** from the Shopping List.

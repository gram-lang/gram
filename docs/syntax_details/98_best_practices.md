# Documentation: Style Guide & Best Practices

GRAM is a flexible language. It is designed to understand a recipe told as a story ("Narrative Style") just as well as a recipe structured like an algorithm ("Script Style").

However, to get the most out of automation features (shopping lists, Gantt charts, scaling), we recommend adopting the **Idiomatic GRAM Style**.

## 1. Writing Levels

There is no "wrong" way to write, but there are ways that are more efficient for the machine.

### Level 1: Narrative Style (Valid)

This is the classic format of food blogs. It is readable by a human, but the parser will struggle to extract the temporal structure from it.

> `In a large bowl, pour the @flour{} and gently add the @milk{} while stirring.`

### Level 2: "Tech Sheet" Style (Recommended ✨)

This is the ideal compromise. Use short sentences, start with the action, and separate advice from code.

> `[Mix] The @flour{} and @milk{} in a #bowl{}. (Pour gently).`

## 2. The 3 Golden Rules of the "GRAM Way"

To write clean, maintainable, and powerful GRAM, follow the **IPO** logic: Input, Process, Output.

### Rule #1: One Step = One Action

Always start your paragraphs with an **Action Verb** in brackets. This allows visually scanning the recipe in a second.

* ✅ `[Knead] The @flour{} and @water{}.`
* ❌ `[Preparation] Take the @flour{} and @water{} and knead them.`

### Rule #2: Clean up the Text (Signal vs Noise)

The step text should contain technical instructions (**What**, **How much**, **How**).

Move the narrative, history, or scientific explanation to comments.

* **The Code:** What I am doing.
* **The Comment:** Why I am doing it.

```gram
// Bad: Mixture of data and anecdotes
[Cook] The @steak{} over high heat. My grandmother always said wait for the pan to smoke, that's the secret to a beautiful crust.

// Good: Clear separation
[Sear] The @steak{} over high heat (smoking pan).
// Tip: A very hot pan is the secret to the Maillard reaction (the crust).
```

### Rule #3: Chain your Preparations

Use intermediate variables (`->&name`) to create a logical thread. This lets the system know that the bowl contains *both* the flour and the sugar.

```gram
[Mix] @flour{} + @sugar{}. ->&dry_mix{}
[Add] @butter{} into &dry_mix{}. ->&sanding{}
[Add] @butter{} into &dry_mix{}. ->&sanding{}
```

### Rule #4: Protect your Ingredients (References)

Don't repeat yourself. If you use an ingredient a second time, use the **Reference** modifier (`@&`).

*   **Declaration** (`@sugar{}`): "I am introducing a new ingredient."
*   **Reference** (`@&sugar{}`): "I am talking about the sugar I mentioned before."

This protects you against typos (`@&suggar{}` will trigger an error) and keeps the shopping list clean (using `@&sugar{}` without quantity triggers specific instruction logic without polluting the list).

## 3. Before / After Comparison

Here is how to transform a classic recipe into Idiomatic GRAM.

| Element | Classic Style (Avoid) | GRAM Style (Prefer) | Why? |
| --- | --- | --- | --- |
| **Verbosity** | "Gently take the eggs..." | `[Clarify] The @eggs{3}.` | Faster to read in the kitchen. |
| **Precision** | "...then cook for a while." | `...for ~{10%min}.` | Allows generating Timers. |
| **Context** | "Watch out, it burns fast!" | `// Watch the browning.` | Cleans up the visual interface. |
| **Structure** | Long paragraphs. | Short lines + Actions. | Allows chart generation. |

---

### Why do this?

By adopting this style, you are not just "noting" a recipe but you're enabling potential automation features such as :

1. **"Matrix" Display** (Action table view).
2. **Automatic Timeline** (Time organization).
3. **Reliable Scaling** (Quantity recalculation).

Be brief and be precise.
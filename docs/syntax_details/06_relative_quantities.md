# GRAM Logic: Relative Quantities (@{...%})

This document details the decision matrix for calculating relative quantities.
The goal is to ensure predictable behavior for the developer and understandable results for the user.

## General Principle

A relative quantity `@A{X% @B}` attempts to answer the question: "How much is X% of B?".

### The Two Target Types

1.  **Ingredient Reference (`@Ingredient`)**: Searches for previous occurrences of this ingredient *within the same section*.
2.  **Variable Reference (`&Preparation`)**: Searches for the intermediate preparation defined previously (`->&Preparation`).

> **Tip:** This makes your recipe "Responsive". Changes to the main ingredient (e.g., scaling the flour) automatically propagate to all relative ingredients, ensuring the ratio remains perfect.

---

## Decision Matrix

For each case, the parser follows this algorithm:

### Case A: Source has MASS (g, kg, ml...)
*The ideal "Mass-Centric" case.*

| Scenario | Source Example | Target Example | Calculation | Shopping List Result |
| :--- | :--- | :--- | :--- | :--- |
| **Simple** | `@Flour{100g}` | `@Sugar{10% @Flour}` | `100g * 0.10` | `Sugar: 10g` |
| **Composite Variable** | `->&Dough{}` (Flour 200g + Water 100g) | `@Salt{2% &Dough}` | `(200+100) * 0.02` | `Salt: 6g` |
| **Mixed** | `->&Mix{}` (Flour 100g + 2 Eggs) | `@Salt{2% &Mix}` | `(100 + 0) * 0.02` | `Salt: 2g` *(Eggs count as 0g)* |

> **Rule:** Non-convertible items (units/pieces) are ignored during mass addition (treated as 0g), but do not invalidate the calculation.

---

### Case B: Source is UNITARY / UNITLESS (pc, unit, "")
*The ambiguous case requiring a UX choice.*

| Scenario | Source Example | Target Example | Current Decision | Shopping List Result |
| :--- | :--- | :--- | :--- | :--- |
| **Simple (Unitless)** | `@Apple{5}` (Units) | `@Sugar{50% @Apple}` | **FALLBACK (Numeric Calc)** <br> `5 * 0.50 = 2.5` | `Sugar: 2.5` *(Inherits unitless status)* |
| **Inherited Unit** | `@Flour{100g}` | `@Sugar{200% @Flour}` | **MASS (Priority)** <br> `100 * 2.0 = 200` | `Sugar: 200g` *(Inherits 'g' from Flour)* |
| **100% Unitary Variable** | `->&Salad{}` (3 Apples + 2 Pears) | `@Sugar{10% &Salad}` | **FALLBACK (Sum)** <br> `(3+2) * 0.10 = 0.5` | `Sugar: 0.5` |
| **Mixed Variable** | `->&Mix{}` (100g Flour + 2 Eggs) | `@Salt{10% &Mix}` | **MASS PRIORITY** <br> `(100g + 0) * 0.10 = 10g` | `Salt: 10g` *(Eggs are ignored)* |

> **Proposed Rule (Fallback)**:
> 1. If Mass > 0 can be calculated → Use **Mass** (Priority).
> 2. If Mass = 0 BUT Units exist → Use **Sum of Units**.
> 3. If mixed (Mass + Unit) → **Mass wins** (units are ignored).

---

### Case C: Errors (Ghost)

| Scenario | Example | Problem | Shopping List Result |
| :--- | :--- | :--- | :--- |
| **Source Not Found** | `@Sugar{10% @Ghost}` | No one is named "@Ghost". | `Sugar: (10% of @Ghost ❓)` |
| **Variable Not Found** | `@Sugar{10% &Unknown}` | `->&Unknown` was never defined. | `Sugar: (10% of &Unknown ❓)` |
| **Empty Source** | `@Water{}` (No qty) | `@Sugar{10% @Water}` | Value = 0 / Null. | `Sugar: 0` *(Or Ghost handling if preferred)* |

---

## Visual Summary (Flowchart)

[![](https://mermaid.ink/img/pako:eNp1k11vmzAUhv_Kka9SlUYEQpwi7Utpm-4iqVTSSWvIhQteQAEc-aPJhrjc3e562_65_JIZE5JNy7iwOfb7nnMesEsUsZgiHy05WScwuwoL0E8gCZdzM8I9zYhMnymMSBYt4OLiPdwSETDFI1o2E1xvUyHFh6pxH7a1GKZ3xjJOmJDz3dsvGN_eBTMfgoRt4IbxXGUEzmH39rI44f56HRj7KKHRakKEKEeskCQtBNRRW7EZD6LW2aFbH3q2vbTMeO7Q5VKcNQk1TC2d715_mgCeiKAxsAImn4Jg30urMpZ7KoxDzyqTkBYw5iQXi_-2oNFNBy6Q9TqjbeVa8lCk8ogyVTnlaQRfSKboCaZa_ReTe4So9-Yh-hfjYfp5Bp0bkmVPJFqdhegPpn1Cw7RPsKfapDJhSoLSqx3GQTS_og6PKU601rJ-3BBJeVk1DT5Sztrv9Q7sBbL0QUtj5EuuqIU0dU7qEJV1yhDJhOY0RL5-jQlfhSgsKu1Zk-KRsby1caaWCfK_kUzoSK1jXfIqJfoI54dVTouY8hFThUR-b-CZJMgv0Rb5Q9x18GUfO67Xs3HfcSz0HfkO7noDpz_AHvZs7Dp9p7LQD1PW7g7xsI891xm4GLveZc9CNE4l45Pm9phLVP0GOPEJGQ?type=png)](https://mermaid.live/edit#pako:eNp1k11vmzAUhv_Kka9SlUYEQpwi7Utpm-4iqVTSSWvIhQteQAEc-aPJhrjc3e562_65_JIZE5JNy7iwOfb7nnMesEsUsZgiHy05WScwuwoL0E8gCZdzM8I9zYhMnymMSBYt4OLiPdwSETDFI1o2E1xvUyHFh6pxH7a1GKZ3xjJOmJDz3dsvGN_eBTMfgoRt4IbxXGUEzmH39rI44f56HRj7KKHRakKEKEeskCQtBNRRW7EZD6LW2aFbH3q2vbTMeO7Q5VKcNQk1TC2d715_mgCeiKAxsAImn4Jg30urMpZ7KoxDzyqTkBYw5iQXi_-2oNFNBy6Q9TqjbeVa8lCk8ogyVTnlaQRfSKboCaZa_ReTe4So9-Yh-hfjYfp5Bp0bkmVPJFqdhegPpn1Cw7RPsKfapDJhSoLSqx3GQTS_og6PKU601rJ-3BBJeVk1DT5Sztrv9Q7sBbL0QUtj5EuuqIU0dU7qEJV1yhDJhOY0RL5-jQlfhSgsKu1Zk-KRsby1caaWCfK_kUzoSK1jXfIqJfoI54dVTouY8hFThUR-b-CZJMgv0Rb5Q9x18GUfO67Xs3HfcSz0HfkO7noDpz_AHvZs7Dp9p7LQD1PW7g7xsI891xm4GLveZc9CNE4l45Pm9phLVP0GOPEJGQ)

## Concrete Display Examples

| Code GRAM | Calculation | Shopping List Display |
| :--- | :--- | :--- |
| `@Sugar{10% @Flour{1kg}}` | 1000 * 0.10 | `Sugar (100 g)` |
| `@Sugar{50% @Apples{4}}` | 4 * 0.50 | `Sugar (2)` |
| `@Sugar{10% @Ghost}` | Impossible | `Sugar (10% of @Ghost ❓)` |
| `@Salt{1% &Dough{Flour 1kg + 3 eggs}}` | 1000 * 0.01 | `Salt (10 g)` |

## Conclusion for the User

1.  **If it has weight**, we calculate weight.
2.  **If it has just a number** (apples, eggs), we calculate a number.
3.  **If it doesn't exist**, we warn you (❓).
4.  **If mixed**, weight wins (we ignore units to avoid adding apples and oranges).

# Yield Calculation (Waste Factor)

> [!IMPORTANT]
> **Physical Analysis Feature**: Yield Calculation is an optional physical enrichment feature handled by the `@gram/analyzer` package. It requires **Mass Standardization** to be active.

The `@gram/analyzer` includes a **Yield Calculation** system to distinguish between the **Net Mass** (what goes into the recipe) and the **Purchasing Mass** (Gross Mass - what you actually need to buy).

## Concept

Many raw ingredients have natural waste (peels, cores, shells).
- **Net Mass**: The weight of the edible part used in cooking.
- **Yield**: The percentage of the raw product that is edible.
- **Gross Mass**: `Net Mass / Yield`.

## Comment ça marche

Par défaut, Gram considère que toute quantité écrite dans votre recette correspond au **Poids Net**. Le générateur de liste de courses va ensuite utiliser le `yield` et le `unit_weight` à l'envers pour vous dire exactement combien acheter.

Prenons deux scénarios pour un avocat (`unit_weight: 150g`, `yield: 0.70`) :

**Scénario A : Recette en Unités (`@avocado{1}`)**
1. L'Analyzer lit "1 unité".
2. Il applique le `unit_weight` : `1 * 150g = 150g`. C'est le **Poids Brut** (ce que vous avez acheté).
3. Il applique le `yield` pour trouver ce qui va dans le bol : `150g * 0.70 = 105g`. C'est le **Poids Net**.

**Scénario B : Recette en Masse (`@avocado{200g}`)**
1. L'Analyzer lit "200g". Il assume que c'est le **Poids Net** dont vous avez besoin.
2. Il applique le `yield` à l'envers pour la liste de courses : `200g / 0.70 = 285g`. C'est le **Poids Brut**.
3. Il utilise le `unit_weight` pour la quantité à acheter : `285g / 150g = 1.9 avocats` (donc achetez-en 2).

## Shopping List Display

In the Shopping List (and Playground), if the **Gross Mass** differs significantly (>5%) from the Net Mass, it is displayed explicitly in parenthetical notation.

*   `Banana: 100g (154g gross)` ➡️ You need 100g of edible flesh, which translates to purchasing 154g of raw bananas.

## Overrides

Yield factors are resolved from the external ingredient database passed to the analyzer. Custom databases can easily customize yield values for highly specialized culinary requirements.

---
title: "Analyse syntaxique & AST"
description: "Comment @gram-lang/parser utilise une grammaire OhmJS pour transformer le texte .gram en Arbre Syntaxique Abstrait."
---

Le *package* `@gram-lang/parser` est le socle de l'écosystème Gram. Son unique responsabilité ? Avaler le texte `.gram` brut et accoucher d'un Arbre Syntaxique Abstrait (AST).

## OhmJS

Les règles de Gram sont codées en [OhmJS](https://ohmjs.org/), un *toolkit* de *parsing* orienté objet, fondé sur les *Parsing Expression Grammars* (PEG).

Ohm permet de construire des grammaires modulaires de manière efficace. Le `@gram-lang/parser` est donc performant et strict sur l'application des règles : par exemple, tout espace autour du marqueur composite `<@` est interdit (`invalidComposite` dans la grammaire). Ainsi, `pâte < @pâtefeuilletée` provoquera une erreur de *parsing*, alors que `<@pâtefeuilletée` sera correctement analysé.

## L'arbre syntaxique abstrait (AST)

En cas de succès, le *parser* retourne un AST. Il s'agit d'un arbre d'objets JavaScript matérialisant chaque *token* sémantique de votre recette.

Par exemple, cette simple étape :
```gram
Ajouter la @farine{200 g}.
```

Sera décomposée en un nœud `Step` abritant un nœud `Text` ("Ajouter la "), un nœud `Ingredient`, et un dernier `Text` pour la ponctuation (".") :
```json
{
  "type": "Ingredient",
  "name": "farine",
  "quantity": {
    "type": "Quantity",
    "value": { "type": "single", "value": 200, "text": "200" },
    "unit": "g",
    "fixed": false
  },
  "modifiers": [],
  "alias": null,
  "preparation": null,
  "composite": null
}
```

Notez bien : `quantity.value` est systématiquement un objet `QuantityValueAST`, jamais un *Number* primitif. C'est l'astuce qui permet de supporter les fractions (`1/2`) et les fourchettes (`2-3`), tout en préservant le texte saisi par l'utilisateur.

### Nœuds AST supportés

Le *parser* exporte un type de nœud spécifique pour chaque concept du langage (`ASTNodeType` dans `src/types.ts`) :
- `Recipe` : Le nœud racine, porteur du frontmatter (`meta`) et des `Section`.
- `Section` : Un groupe de `Step` et `Comment`. Elle peut porter en bonus une ancre de rétroplanning (`~{...}`) et une variable intermédiaire.
- `Step` : Un paragraphe contenant des `Text`, `Ingredient`, `Cookware`, `Timer`, `Temperature`, `Reference`, `Alternative`, `IntermediateDecl`, ou `Comment`. Elle peut s'ouvrir sur une balise d'action `[Préchauffer]`.
- `Ingredient` / `Cookware` : Peuvent être encapsulés dans une `Alternative` s'ils exploitent l'opérateur `|` (`@beurre|@margarine`).
- `Quantity`, `RelativeQuantity`, `TextQuantity` : Les trois profils d'une quantité — classique (valeur/fraction/plage + unité), relative (`50 % @farine`), ou texte libre non-numérique.
- `Composite` : Le marqueur magique (`<@citron`) pour ré-assembler les morceaux (zeste, jus) en un article parent unifié.
- `Comment` : Un commentaire de ligne `//` ou un commentaire de bloc `/* */`.

:::tip[Les modificateurs sont des symboles bruts]
Le tableau `modifiers` des nœuds `Ingredient`/`Cookware` conserve directement les caractères bruts saisis (`?`, `-`, `*`, `&`) plutôt que des libellés sémantiques. Seule exception : `=`, qui est intercepté pour passer `quantity.fixed` à `true` sans figurer dans le tableau.
:::

## Purement syntaxique

`@gram-lang/parser` est bête et discipliné : aucune sémantique, aucune *business logic*. Il ignore totalement :
- Si la variable `&pâte` a bien été déclarée en amont.
- Si vos `200 g` de `farine` sont convertibles ou proportionnels.
- Si votre foutue `farine` existe dans `ingredients.yaml`.

Il s'autorise néanmoins quelques micro-ajustements purement locaux en montant l'arbre : valider le frontmatter Zod (et le *dropper* silencieusement s'il est invalide), faire la moyenne d'une plage par courtoisie (`2-3` donne `2.5`), et lever une belle erreur sur les composites mal formés. Rien de tout ça ne nécessite de contexte global. L'arbre final, vierge de tout état, sera refilé à `@gram-lang/kitchen` pour la vraie validation métier.

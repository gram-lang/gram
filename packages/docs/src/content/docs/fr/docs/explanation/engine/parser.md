---
title: "Analyse Syntaxique & AST"
description: "Comment @gram-lang/parser utilise une grammaire OhmJS pour transformer le texte .gram en Arbre Syntaxique Abstrait."
---

Le paquet `@gram-lang/parser` est la fondation de l'écosystème Gram. Sa seule responsabilité est de lire le texte brut `.gram` et de le convertir en un Arbre Syntaxique Abstrait (AST).

## OhmJS

Les règles de syntaxe de Gram sont définies en utilisant [OhmJS](https://ohmjs.org/), une boîte à outils d'analyse syntaxique orientée objet basée sur les Grammaires d'Expression d'Analyse (PEG - Parsing Expression Grammars).

Ohm rend extrêmement facile la construction de grammaires modulaires. Grâce à cela, `@gram-lang/parser` est incroyablement rapide et applique strictement les règles structurelles du langage — par exemple, un espace est formellement interdit autour du marqueur composite `<@` (`invalidComposite` dans la grammaire), donc `pâte < @pâtefeuilletée` échouera à l'analyse alors que `<@pâtefeuilletée` réussira.

## L'Arbre Syntaxique Abstrait (AST)

Si l'analyseur réussit, il produit un AST. Il s'agit d'un arbre d'objets JavaScript représentant chaque jeton (token) sémantique de la recette.

Par exemple, cette simple étape :
```gram
Ajouter la @farine{200 g}.
```

Est analysée en un nœud `Step` contenant un nœud `Text` ("Ajouter la "), un nœud `Ingredient`, et un nœud `Text` de fin (".") :
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

Notez que `quantity.value` est toujours un objet `QuantityValueAST`, jamais un simple nombre — c'est ce qui permet à l'analyseur de représenter aussi des fractions (`1/2`) et des plages (`2-3`) sans perdre la représentation textuelle d'origine.

### Nœuds AST Supportés

L'analyseur expose des types de nœuds spécifiques pour tout ce qui existe dans le langage Gram (`ASTNodeType` dans `src/types.ts`) :
- `Recipe` : Le nœud racine contenant le frontmatter (`meta`) et une liste de nœuds `Section`.
- `Section` : Un groupe de nœuds `Step` et `Comment` de premier niveau. Une section peut également porter un en-tête de rétroplanning optionnel (`~{...}`) et une déclaration intermédiaire.
- `Step` : Un paragraphe unique contenant des nœuds `Text`, `Ingredient`, `Cookware`, `Timer`, `Temperature`, `Reference`, `Alternative`, `IntermediateDecl`, et `Comment`. Une étape peut aussi commencer par une balise optionnelle `action` entre crochets (ex : `[Préchauffer]`).
- `Ingredient` / `Cookware` : Peuvent eux-mêmes être enveloppés dans un nœud `Alternative` lorsqu'ils sont écrits avec l'opérateur `|` (ex : `@beurre|@margarine`).
- `Quantity`, `RelativeQuantity`, `TextQuantity` : Les trois formes possibles qu'une quantité peut prendre — une valeur numérique/fraction/plage avec une unité, un pourcentage relatif à un autre ingrédient (`50 % @farine`), ou un texte libre qui n'a pas pu être analysé comme un nombre.
- `Composite` : Représente une référence d'ingrédient composite (`<@citron`), utilisée pour regrouper les parties (zeste, jus) en un article entier.
- `Comment` : Un commentaire de ligne `//` ou un commentaire de bloc `/* */`.

:::tip[Les modificateurs sont des symboles bruts]
Le tableau `modifiers` sur les nœuds `Ingredient`/`Cookware` contient les caractères de ponctuation bruts tels qu'écrits dans le fichier source (`?`, `-`, `*`, `&`), et non des libellés sémantiques. `=` est géré séparément : il n'apparaît pas du tout dans `modifiers`, il passe plutôt `quantity.fixed` à `true`.
:::

## Purement Syntaxique

`@gram-lang/parser` n'effectue aucun raisonnement métier ou sémantique. Il n'a aucune connaissance sur :
- Le fait qu'une variable référencée `&pâte` ait réellement été déclarée plus tôt.
- Le fait que `200 g` de `farine` ait besoin d'être mis à l'échelle ou converti.
- Le fait que la `farine` existe dans votre base de données `ingredients.yaml`.

Cependant, il effectue une petite quantité de travail local, non-sémantique, tout en construisant l'arbre : il valide le frontmatter de la recette par rapport à un schéma (le supprimant silencieusement s'il est invalide), calcule la moyenne des deux limites d'une plage (`2-3` → suivi avec une moyenne de `2.5`) par commodité, et lève une erreur de syntaxe lisible lorsqu'il détecte une référence composite mal formée. Rien de tout cela ne requiert de connaître le reste de la recette — l'analyseur transmet un arbre purement structurel à `@gram-lang/kitchen`, où la véritable résolution de références et la validation auront lieu.

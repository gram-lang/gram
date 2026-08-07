---
title: "Variables Intermédiaires"
description: "Déclarez des sous-composants réutilisables comme une pâte ou une sauce en tant que &variables intermédiaires."
---

Dans les recettes un peu denses, on produit souvent des sous-composants (une pâte, une sauce, un glaçage) destinés à être incorporés plus tard. Gram permet de formaliser ces sous-composants sous forme de **Variables intermédiaires**.

Une fois déclarée, une `&variable` intermédiaire se comporte exactement comme un `@ingrédient` : vous pouvez y faire référence, la mesurer ou l'utiliser comme base de calcul pour des pourcentages.

## Déclarer une Variable

Pour déclarer une `&variable`, utilisez la syntaxe `->&`. Deux emplacements sont valides : à la toute fin d'une **Étape**, ou à la fin d'un **Titre de Section**.

### Déclaration au niveau de l'Étape

Lorsqu'elle clôture une étape (un paragraphe), la `&variable` capture purement et simplement le résultat de cette étape précise.

```gram
[Ajouter] La @farine{200 g} et l'@eau{100 ml}. Mélanger jusqu'à ce que ce soit homogène. ->&pâte

[Repos] Laisser la &pâte reposer pendant ~_{1 h}.
```

### Déclaration au niveau de la Section

Lorsqu'elle est placée à la fin d'un titre de `## Section`, la `&variable` capture le produit de *l'ensemble* des étapes de cette section. C'est la mécanique idéale pour les sous-composants nécessitant une préparation longue.

```gram
## Pâte Feuilletée ->&pâte feuilletée{}

[Mélanger] La @farine{250 g}, l'@eau{120 ml}, et le @sel{5 g}.

[Repos] Au #réfrigérateur pendant ~_{1 h}.

[Incorporer] Le @beurre{200 g} en pliant la pâte plusieurs fois.

// La `&variable` pâte feuilletée contient maintenant le résultat final de toutes les étapes ci-dessus !
```

## Utiliser une Variable

Pour utiliser une `&variable` préalablement déclarée, préfixez simplement son nom avec `&`. 

```gram
Utiliser la &pâte feuilletée{} pour foncer le moule à tarte.
```

Vous pouvez également lui attribuer une quantité pour l'affichage dans la recette rendue :

```gram
Prendre de la &pâte feuilletée{200 g} et l'étaler.
```

:::note[Liste de Courses vs Ingrédients de Recette]
Lorsqu'elle est consommée dans une étape ultérieure, une `&variable` intermédiaire **apparaîtra** dans la liste des ingrédients de cette section (au même titre que n'importe quel ingrédient brut). 

Néanmoins, elle **n'apparaîtra jamais** dans la **liste de courses globale**. Le compilateur Gram a parfaitement conscience que la `&pâte feuilletée` se compose déjà de farine et de beurre : il la décomposera automatiquement pour agréger les ingrédients bruts à votre liste de courses.
:::

## Mécanismes Avancés

### Portée Globale (Global Scoping)
Lorsqu'une `&variable` est déclarée au niveau d'une section, elle intègre la **portée globale** (*global scope*). Cela signifie que vous pouvez déclarer une `&variable` dans la toute première section de votre recette et la référencer sans risque dans la dernière.

### Quantités Relatives
Comme détaillé dans la documentation sur les [Quantités Relatives](/fr/docs/reference/syntax/relative-quantities), vous pouvez calculer la masse d'un ingrédient en fonction de la masse totale d'une variable intermédiaire.

```gram
[Mélanger] Les ingrédients pour former la pâte. ->&pâte

[Ajouter] Le @sel{2 % &pâte}.
```

## Gestion des Erreurs

Le compilateur vous aide à maintenir un code propre et sans conflits en émettant des avertissements spécifiques :

- **Conflit de portée (*Scope Conflict*)** : Si vous déclarez accidentellement un même nom de `&variable` dans deux blocs `## Section` différents, le compilateur remontera un *warning* `SCOPE_CONFLICT`.
- **Variable inutilisée (*Unused Variable*)** : Toute `&variable` déclarée via `->&` **doit** être consommée plus tard dans la recette. Si vous déclarez une variable orpheline, le compilateur vous le signalera pour vous aider à garder un code propre.

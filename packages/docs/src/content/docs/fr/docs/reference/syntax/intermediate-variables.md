---
title: "Variables Intermédiaires"
description: "Déclarez des sous-composants réutilisables comme une pâte ou une sauce en tant que &variables intermédiaires."
---

Dans les recettes complexes, vous créez souvent des sous-composants (comme une pâte, une sauce ou un glaçage) qui sont ensuite utilisés dans des étapes ultérieures. Gram vous permet de déclarer ces sous-composants comme des **Variables Intermédiaires**.

Une fois déclarée, une `&variable` intermédiaire agit exactement comme un `@ingrédient`, vous permettant d'y faire référence, de la mesurer ou de calculer des pourcentages à partir de celle-ci.

## Déclarer une Variable

Vous pouvez déclarer une `&variable` en utilisant la syntaxe `->&`. Il y a deux endroits où vous pouvez les déclarer : à la fin d'une **Étape**, ou à la fin d'un **Titre de Section**.

### Déclaration au niveau de l'Étape

Lorsqu'elle est placée tout à la fin d'une étape (un paragraphe), la `&variable` capture tout ce qui a été produit dans cette étape spécifique.

```gram
[Ajouter] La @farine{200 g} et l'@eau{100 ml}. Mélanger jusqu'à ce que ce soit homogène. ->&pâte

[Repos] Laisser la &pâte reposer pendant ~_{1 h}.
```

### Déclaration au niveau de la Section

Lorsqu'elle est placée à la fin d'un titre de `## Section`, la `&variable` capture le résultat de *l'ensemble* de la section. C'est parfait pour les composants qui nécessitent plusieurs étapes de préparation.

```gram
## Pâte Feuilletée ->&pâte feuilletée{}

[Mélanger] La @farine{250 g}, l'@eau{120 ml}, et le @sel{5 g}.

[Repos] Au #réfrigérateur pendant ~_{1 h}.

[Incorporer] Le @beurre{200 g} en pliant la pâte plusieurs fois.

// La `&variable` pâte feuilletée contient maintenant le résultat final de toutes les étapes ci-dessus !
```

## Utiliser une Variable

Pour utiliser une `&variable` préalablement déclarée, référencez-la simplement avec `&`. 

```gram
Utiliser la &pâte feuilletée{} pour foncer le moule à tarte.
```

Vous pouvez également lui attribuer une quantité pour l'affichage dans la recette rendue :

```gram
Prendre de la &pâte feuilletée{200 g} et l'étaler.
```

:::note[Liste de Courses vs Ingrédients de Recette]
Lorsque vous utilisez une `&variable` intermédiaire dans une étape ultérieure, elle **apparaîtra** dans la liste des ingrédients de la Recette pour cette section, tout comme n'importe quel ingrédient régulier. 

Cependant, elle **n'apparaîtra pas** dans la **Liste de Courses** globale. Le compilateur Gram sait que la `&pâte feuilletée` est composée de farine et de beurre, et il va automatiquement la décomposer et ajouter la farine et le beurre crus à votre liste de courses à la place.
:::

## Mécanismes Avancés

### Portée Globale (Global Scoping)
Lorsqu'une `&variable` est déclarée au niveau d'une Section, elle est enregistrée dans la **Portée Globale**. Cela signifie que vous pouvez déclarer une `&variable` dans la première section de votre recette et y faire référence en toute sécurité dans la dernière section.

### Quantités Relatives
Comme détaillé dans la documentation sur les [Quantités Relatives](./relative-quantities.md), vous pouvez calculer la masse d'un ingrédient en fonction de la masse totale d'une variable intermédiaire.

```gram
[Mélanger] Les ingrédients pour former la pâte. ->&pâte

[Ajouter] Le @sel{2 % &pâte}.
```

## Gestion des Erreurs

Le compilateur vous aide à maintenir un code propre et sans conflits en émettant des avertissements spécifiques :

- **Conflit de Portée (Scope Conflict)** : Si vous déclarez accidentellement le même nom de `&variable` deux fois dans des blocs de `## Section` différents, le compilateur émettra un avertissement `SCOPE_CONFLICT`.
- **Variable Inutilisée (Unused Variable)** : Toute `&variable` déclarée avec `->&` **doit** être utilisée plus tard dans la recette. Si vous déclarez une `&variable` mais que vous n'y faites jamais référence, le compilateur déclenchera un avertissement pour vous aider à garder le code de votre recette propre.

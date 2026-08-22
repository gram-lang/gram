---
title: "Matériel"
description: "Comment déclarer le matériel de cuisine avec le symbole #, entre nombre d'unités et dimensions physiques."
---

Le matériel, les ustensiles et l'équipement requis par une recette se déclarent via le symbole `#`.

## Déclaration de base

À l'instar d'un `@ingrédient`, si le nom du `#matériel` tient en un seul mot et que vous n'en réclamez qu'un exemplaire, les accolades `{}` sont facultatives.

```gram
Faire chauffer la #poêle.
```

Si le nom contient des espaces ou si vous souhaitez spécifier une quantité, vous devez utiliser des accolades `{}`.

```gram
Prendre une #plaque de cuisson{}.
```

## Quantités vs dimensions

Contrairement à un `@ingrédient` (qui encaisse des unités complexes comme des grammes ou des tasses), le `#matériel` impose une séparation syntaxique stricte entre sa **quantité** et sa **description physique**.

### 1. Quantité (nombre entier)
Les accolades `{}` sont strictement réservées au nombre d'ustensiles nécessaires. Il doit impérativement s'agir d'un entier.

```gram
#poêle              // Vaut 1 poêle par défaut
#ramequins{4}       // 4 ramequins
```

### 2. Dimensions et matériaux
Pour préciser la taille, les dimensions, le matériau ou tout autre qualificatif du `#matériel`, utilisez les parenthèses `()`.

```gram
#poêle(20cm)                        // 1 poêle, de taille 20cm
#plaque de cuisson{2}(antiadhésive) // 2 plaques de cuisson, antiadhésives
```

:::caution
Ne mettez pas les dimensions à l'intérieur des accolades de quantité (ex : ❌ `#poêle{20cm}`). Gram attend un entier strict à l'intérieur de `{}`. Utilisez plutôt des parenthèses : ✅ `#poêle(20cm)`.
:::

## Ajustement selon les portions

Contrairement à un `@ingrédient` dont les quantités sont par défaut proportionnelles au nombre de portions, l'adaptation du `#matériel` lors d'un changement de portions dépend de la façon dont sa quantité a été formulée :

| Forme | Exemple | Type | Comportement lors de l'ajustement |
| --- | --- | --- | --- |
| **Sans quantité** | `#poêle` | **Fixe** | Ne varie pas avec les portions. |
| **Avec quantité** | `#poêle{1}` ou `#ramequins{4}` | **Évolutif** | Doubler la recette demandera 2 poêles ou 8 ramequins. |
| **Fixe Explicite** | `#=poêle{2}` | **Fixe** | Même si vous doublez la recette, elle ne demandera toujours que 2 poêles. |

## Modificateurs et syntaxe avancée

Le `#matériel` prend en charge un grand nombre des fonctionnalités de syntaxe avancée des `@ingrédients`. Pour une explication détaillée de ces concepts, référez-vous à la [documentation sur les Ingrédients](/fr/docs/reference/syntax/ingredients).

### [Modificateurs](/fr/docs/reference/syntax/ingredients#modificateurs-dingrédient)
Vous pouvez utiliser les modificateurs Optionnel (`?`), Masqué (`-`), Fixe (`=`), et Référence (`&`) sur le `#matériel`.

```gram
Utiliser un #?wok si vous en avez un, sinon une #-grande poêle conviendra.

Retourner au #&wok pour terminer la sauce.
```

### [Alias de composant (renommage)](/fr/docs/reference/syntax/ingredients#alias-de-composant-renommage)
Vous pouvez renommer un `#matériel` pour l'affichage en utilisant l'opérateur `:`.

```gram
Utiliser la #poêle en fonte:poêle{}.
```

### [Alternatives](/fr/docs/reference/syntax/ingredients#alternatives-substitutions)
Vous pouvez définir des alternatives acceptables en utilisant l'opérateur pipe `|`.

```gram
Cuire dans une #poêle|#wok.
```

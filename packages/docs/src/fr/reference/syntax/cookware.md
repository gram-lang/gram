# Matériel (Cookware)

Vous pouvez définir les ustensiles et l'équipement nécessaires pour une recette à l'aide du symbole `#`.

## Déclaration de Base

Tout comme pour un `@ingrédient`, si le nom du `#matériel` est un mot unique et que vous n'en avez besoin que d'un seul, vous pouvez omettre les accolades `{}`.

```gram
Faire chauffer la #poêle.
```

Si le nom contient des espaces ou si vous souhaitez spécifier une quantité, vous devez utiliser des accolades `{}`.

```gram
Prendre une #plaque de cuisson{}.
```

## Quantités vs Dimensions

Contrairement à un `@ingrédient` (qui peut avoir des unités complexes comme des grammes ou des tasses), le `#matériel` possède une séparation syntaxique stricte entre son **nombre** et sa **description physique**.

### 1. Quantité (Nombre Entier)
Les accolades `{}` sont strictement réservées au nombre d'éléments dont vous avez besoin. Ce doit être un entier pur.

```gram
#poêle              // Vaut 1 poêle par défaut
#ramequins{4}       // 4 ramequins
```

### 2. Dimensions et Matériaux
Pour spécifier la taille, les dimensions, le matériau, ou toute autre description du `#matériel`, vous devez utiliser des parenthèses `()`.

```gram
#poêle(20cm)                        // 1 poêle, de taille 20cm
#plaque de cuisson{2}(antiadhésive) // 2 plaques de cuisson, antiadhésives
```

::: warning
Ne mettez pas les dimensions à l'intérieur des accolades de quantité (ex : ❌ `#poêle{20cm}`). Gram attend un entier strict à l'intérieur de `{}`. Utilisez plutôt des parenthèses : ✅ `#poêle(20cm)`.
:::

## Comportement de Mise à l'échelle

Contrairement à un `@ingrédient` qui se met généralement à l'échelle de façon linéaire par défaut, le comportement de mise à l'échelle du `#matériel` dépend de la façon dont la quantité est spécifiée :

| Format | Exemple | Comportement | Description |
| :--- | :--- | :--- | :--- |
| **Sans quantité** | `#poêle` | **Fixe** | Ne se met pas à l'échelle. |
| **Avec quantité** | `#poêle{1}` ou `#ramequins{4}` | **Évolutif** | Doubler la recette demandera 2 poêles ou 8 ramequins. |
| **Fixe Explicite** | `#=poêle{2}` | **Fixe** | Même si vous doublez la recette, elle ne demandera toujours que 2 poêles. |

## Modificateurs et Syntaxe Avancée

Le `#matériel` prend en charge un grand nombre des fonctionnalités de syntaxe avancée des `@ingrédients`. Pour une explication détaillée de ces concepts, référez-vous à la [documentation sur les Ingrédients](./ingredients.md).

### [Modificateurs](./ingredients.md#modificateurs-d-ingredient)
Vous pouvez utiliser les modificateurs Optionnel (`?`), Masqué (`-`), et Fixe (`=`) sur le `#matériel`.

```gram
Utiliser un #?wok si vous en avez un, sinon une #-grande poêle fera l'affaire.
```

### [Alias de Composant (Renommage)](./ingredients.md#alias-de-composant-renommage)
Vous pouvez renommer un `#matériel` pour l'affichage en utilisant l'opérateur `:`.

```gram
Utiliser la #poêle en fonte:poêle{}.
```

### [Alternatives](./ingredients.md#alternatives-substitutions)
Vous pouvez définir des alternatives acceptables en utilisant l'opérateur pipe `|`.

```gram
Cuire dans une #poêle|#wok.
```

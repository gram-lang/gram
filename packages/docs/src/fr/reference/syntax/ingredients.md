# Ingrédients

Les ingrédients sont les éléments fondamentaux de toute recette Gram.

## Déclaration de Base

Pour déclarer un `@ingrédient`, utilisez le symbole `@`. Si le nom de l'`@ingrédient` contient des espaces ou requiert une quantité spécifique, vous **devez** ajouter la quantité entre accolades `{}`. S'il s'agit d'un mot unique sans quantité spécifique, les accolades sont facultatives (la quantité vaudra 1 par défaut).

```gram
[Ajouter] @sel et @poivre noir moulu{} au goût.

[Piquer] Des trous dans les @pommes de terre{2}.
```

> **Note :** Les noms d'`@ingrédient` peuvent contenir des caractères spéciaux (comme `'`, `&`, `.`), à l'exception des délimiteurs de syntaxe réservés (`{`, `}`, `:`, `(`, `)`, `<`, `|`).

### Unités
Pour spécifier une unité de mesure (poids, volume, etc.), ajoutez-la directement après la valeur numérique à l'intérieur des accolades, séparée par un espace facultatif.

```gram
[Placer] Les @tranches de bacon{1 kg} sur une plaque de cuisson et glacer avec du @sirop{1/2 c.à.s}.
```

## Mise à l'échelle & Quantités Fixes

Par défaut, le Compilateur Gram met à l'échelle un `@ingrédient` de manière **linéaire** en fonction du nombre de portions demandées. 
Si vous adaptez une recette de 2 à 4 portions, un `@ingrédient` avec `{100 g}` devient `{200 g}`.

### Quantités Fixes (`=`)
Certains `@ingrédients` (comme le sel, la levure ou les épices) ne doivent pas être mis à l'échelle linéairement. Vous pouvez verrouiller leur quantité à l'aide du modificateur `=`.

```gram
Assaisonner avec @=sel{1 c.à.c} au goût.
```
Cela maintient le sel à 1 c.à.c, peu importe le nombre de portions calculé par l'utilisateur.

## Modificateurs d'Ingrédient

Gram fournit plusieurs modificateurs pour altérer le comportement d'un `@ingrédient` dans l'analyseur (parser) et dans la liste de courses. Les modificateurs sont placés immédiatement après le symbole `@`.

| Modificateur | Nom | Effet |
|---|---|---|
| `&` | **Référence** | Fait référence à un `@ingrédient` précédemment déclaré. Ne l'ajoute PAS une seconde fois à la liste de courses. |
| `=` | **Fixe** | Marque la quantité comme fixe (elle ne sera pas mise à l'échelle avec les portions). |
| `?` | **Optionnel** | Marque l'`@ingrédient` comme facultatif. |
| `-` | **Masqué** | Masque l'`@ingrédient` dans la liste de courses générée. |
| `*` | **% du Boulanger** | Marque l'`@ingrédient` comme référence (100 %) pour calculer les pourcentages du boulanger. |

::: warning Combinaison de Modificateurs
Vous pouvez combiner des modificateurs (ex : `@?-thym`). Cependant, les combinaisons absurdes (ex : `?*`, `-*`, `-&`) ou les doublons (`**`) généreront un avertissement du compilateur (`INVALID_MODIFIER_COMBINATION`).
:::

### Le Modificateur de Référence (`&`)

Le modificateur de référence est crucial pour les recettes à plusieurs étapes. **En règle générale, chaque fois que vous mentionnez un `@ingrédient` après sa déclaration initiale, vous devriez utiliser le modificateur `&`.**

Le comportement du compilateur change selon que vous indiquez ou non une nouvelle quantité avec votre référence :

1. **Référence Pure (Sans Quantité)**
Lorsque vous demandez à l'utilisateur d'utiliser un `@ingrédient` déjà déclaré, utilisez `@&` pour éviter qu'il ne soit compté deux fois dans la liste de courses.
```gram
[Ajouter] La @farine{200 g} dans le bol.

[Fleurer] Le plan de travail avec la @&farine.
```

2. **Référence Additive (Avec Quantité)**
Parfois, vous devez utiliser le *même* `@ingrédient` plusieurs fois avec des ajouts *différents* tout au long de la recette. Utiliser `@&ingrédient{quantité}` indique au compilateur : "C'est le même `@ingrédient`, merci d'ajouter cette quantité supplémentaire au total de la liste de courses."
```gram
[Ajouter] Le @beurre{100 g} à la pâte.

[Graisser] Utiliser le @&beurre{50 g} pour graisser le moule. // La liste de courses agrégera correctement 150 g de beurre.
```

### Pourcentage du Boulanger (`*`)

En boulangerie, les recettes sont souvent construites autour du **Pourcentage du Boulanger**, où l'`@ingrédient` principal (généralement la farine) représente 100 %, et tous les autres éléments sont exprimés en pourcentage de ce poids.

Gram fournit un modificateur dédié pour marquer l'`@ingrédient` de référence. En plaçant un `*` après le symbole `@`, vous indiquez au Compilateur Gram : *"Ceci est le point de référence à 100 %"*.

```gram
[Ajouter] La @*farine{500 g}, l'@eau{350 g} et le @sel{10 g}.
```

Cela permet aux outils (comme le CLI ou les interfaces web) de calculer et d'afficher automatiquement les pourcentages du boulanger pour tous les autres éléments (ex : Eau : 70 %, Sel : 2 %) sans que vous n'ayez à les définir manuellement comme quantités relatives.

> **Note :** Pour un guide complet sur l'utilisation de cette fonctionnalité, consultez le guide sur la [Mise à l'échelle dynamique des Recettes](../../how-to/scale-recipes.md#bakers-math).

## Syntaxe Avancée

### Préparations Courtes
Souvent, un `@ingrédient` nécessite une préparation avant utilisation. Vous pouvez définir cela directement dans la déclaration à l'aide de parenthèses `()`.

```gram
[Mélanger] Le @beurre{1 plaquette}(à température ambiante) et l'@ail{2 gousses}(épluchées et hachées).
```

::: tip Bonne Pratique : Étapes en ligne vs Étapes complètes
Gram encourage la rédaction de recettes denses et orientées données. Au lieu de créer des étapes dédiées pour les tâches de base de *mise en place* (ex : `[Éplucher] L'ail.` puis `[Hacher] L'ail.`), il est fortement recommandé de déclarer ces états en ligne à l'aide de `(...)`. Cela garde votre recette concise, évite de polluer le flux des étapes, et permet aux interfaces d'affichage de regrouper proprement les préparations dans la liste des ingrédients !
:::

::: warning L'espacement est strict
La parenthèse de préparation `(...)` DOIT être immédiatement collée aux accolades de quantité `{...}` (ou au nom s'il n'y a pas d'accolades). N'ajoutez pas d'espace entre les deux, sinon cela sera analysé comme du texte brut.
:::

### Alias de Composant (Renommage)
Vous pouvez renommer un `@ingrédient` pour l'affichage à l'aide de deux-points `:` juste après le vrai nom. C'est utile pour garder une liste de courses propre tout en utilisant une appellation courante dans les instructions.

**Format** : `@Vrai Nom:Nom d'Affichage{Quantité}`

::: code-group

```gram [Code]
Déglacer avec le @vin blanc sec:vin{100 ml}.
```

```markdown [Recette Rendu]
1. Déglacer avec le **vin** (100 ml).
```

```markdown [Liste de Courses]
- **vin blanc sec**: 100 ml
```

:::

La liste de courses fera l'agrégation sous "vin blanc sec", mais la recette affichée indiquera simplement "vin".

::: tip Réutiliser des ingrédients avec alias
Les alias sont appliqués localement. Pour mentionner à nouveau ce même `@ingrédient` plus tard dans la recette, vous devez référencer son **vrai nom**, et non l'alias (ex : `@&vin blanc sec`). Si vous écrivez `@vin`, Gram le considérera comme un tout nouvel `@ingrédient`.
:::

### Alternatives (Substitutions)
Vous pouvez définir des alternatives acceptables pour un `@ingrédient` en utilisant l'opérateur pipe `|`.

```gram
Ajouter le @lait{100 ml}|@eau{95 ml}.
```
Cela fonctionne également avec les préparations courtes :
```gram
@oignon{1}(épluché et émincé)|@échalotes{2}(hachées)
```

### Plages (Intervalles)
Les recettes ne sont pas toujours exactes. Vous pouvez spécifier une plage de valeurs en utilisant un trait d'union `-`.

```gram
Ajouter les @œufs{2-4}.

Verser l'@eau{1.5-2 L}.
```

## Gestion des Erreurs

Le compilateur vérifie les erreurs sémantiques dans vos déclarations d'`@ingrédient` et produira des avertissements spécifiques :

- **Modificateur Invalide** : Si vous combinez des modificateurs incompatibles (comme `?*`), le compilateur avertit `INVALID_MODIFIER_COMBINATION` et les ignore.
- **Référence Non Définie** : Si vous utilisez une référence (`@&ingrédient`) mais que cet élément n'a pas été déclaré précédemment dans la recette, le compilateur avertit `UNDEFINED_REFERENCE`.
- **Base de Données Manquante** : Si vous compilez avec une base de données et que l'`@ingrédient` est introuvable, il avertit `MISSING_INGREDIENT`.
- **Macros Manquants** : Si la base de données ne contient pas d'informations nutritionnelles pour l'`@ingrédient`, il avertit `MISSING_MACROS`.
- **Masse Inconnue** : S'il ne peut pas convertir un volume ou une unité en grammes pour estimer la nutrition, il avertit `UNKNOWN_MASS`.

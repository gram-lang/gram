---
title: "Quantités Relatives"
---

En cuisine, et particulièrement en pâtisserie, la précision est primordiale. Se reposer sur des quantités fixes peut parfois mener à des recettes déséquilibrées lorsque le rendement des ingrédients crus varie (ex : un citron qui donne plus de jus que prévu).

Gram résout ce problème en vous permettant de définir la quantité d'un `@ingrédient` dynamiquement comme un pourcentage d'un autre `@ingrédient` ou d'une `&variable` intermédiaire. Cela garantit que votre recette reste parfaitement équilibrée, quelles que soient les variations de la vie réelle.

## Syntaxe

Vous pouvez cibler soit un **Ingrédient** de base, soit une **Variable Intermédiaire**.

```gram
// Cibler un ingrédient de base (en utilisant @&)

Ajouter la @farine{100 g} dans le bol.

Puis incorporer l'@eau{70% @&farine}. // eau = 70 g

// Cibler une variable intermédiaire (en utilisant &)

Mélanger les ingrédients pour former la pâte. ->&pâte

Ajouter le @sel{2 % &pâte}. // 2 % de la masse totale de la variable &pâte
```

**Formats :**
- `@nom{ valeur % @&IngredientCible }`
- `@nom{ valeur % &VariableCible }`

## Règles de Résolution

Lorsque le compilateur Gram calcule une quantité relative, il suit ces règles strictes :

| Règle | Ce que cela signifie pour vous |
| :--- | :--- |
| **Portée de la Section** | Vous ne **pouvez pas** cibler un `@ingrédient` ou une `&variable` déclaré(e) dans une `## Section` différente. Le compilateur ne regarde que la section courante. |
| **Accumulation** | Si vous déclarez le même `@ingrédient` plusieurs fois dans une `## Section`, le pourcentage sera appliqué à la **somme totale** de ces quantités. |
| **Basé sur la Masse** | Le calcul est toujours basé sur le **poids en grammes**. Par exemple, 50 % de "2 œufs" (50 g chacun) donnera **50 g**, et non 1 œuf. |

## Règles de Calcul des Masses

Puisque les quantités relatives reposent sur le calcul de pourcentages de masses existantes, l'analyseur (`@gram-lang/analyzer`) standardise les masses avant de calculer :

| Type d'Unité Cible | Logique avant d'appliquer le pourcentage | Exemple |
| :--- | :--- | :--- |
| **Masse Explicite** (g, kg, oz) | Aucune. Calcul direct. | `50 %` de `500 g` = **250 g** |
| **Volume** (ml, L, tasse) | Convertit en grammes en utilisant le champ `physical.density` de l'`@ingrédient` dans la base de données YAML. | 500 ml d'eau ➡️ 500 g.<br/>`50 %` = **250 g** |
| **Nombre** (`@œuf{2}`) | Recherche le champ `physical.unit_weight` moyen dans la base de données YAML. | 2 œufs (50 g l'unité) ➡️ 100 g.<br/>`50 %` = **50 g** |
| **Inconnu** (`1 flasque`) | Ne peut pas deviner. Émet un avertissement `UNKNOWN_MASS`. | Laisse la quantité non résolue. |

## Comportement de la Liste de Courses

Parce que les quantités relatives sont essentiellement des formules mathématiques (ex : `125 % du jus de citron`), le compilateur Gram doit décider comment les afficher dans la **Liste de Courses** finale. Il le fait en fonction de sa capacité à résoudre la formule en une masse physique.

### 1. Entièrement Résolue (Comportement Standard)

Si le compilateur parvient à déterminer la masse physique de la cible (en utilisant les règles de calcul ci-dessus), il évalue la formule. Le résultat est traité exactement comme une masse physique fixe et est agrégé de manière transparente dans votre liste de courses. Vous ne verrez pas les mathématiques internes, seulement le poids final requis pour les achats.

*Exemple de Liste de Courses :*
```text
- Sucre : 156g
```

### 2. Non Résolue & Sortie Hybride

Parfois, le compilateur ne peut pas évaluer la formule. Cela se produit si vous avez désactivé la standardisation des masses globalement, ou si la masse de la cible est totalement inconnue (ex : la cible utilise une unité non standardisée comme `1 flasque`, ou bien elle nécessite une conversion volume-masse mais l'`@ingrédient` est absent de votre base `ingredients.yaml`).

Dans ce cas, Gram ne peut pas vous donner un poids final en grammes. Au lieu de cela, il recourt à une **Sortie Hybride**. Il affichera le texte brut de la formule, et y ajoutera proprement toute autre quantité fixe de cet `@ingrédient` qu'il a trouvée dans la recette.

*Exemple de Liste de Courses (en supposant que la recette utilise aussi un `@sucre{20 g}` fixe ailleurs) :*
```text
- Sucre : 20g + (125 % du jus de citron)
```
Cela garantit que vous ne perdez jamais vos exigences d'achat, même si les calculs ne peuvent pas être parfaitement résolus !

## Gestion des Erreurs

Le compilateur est conçu pour attraper les erreurs de logique dans les quantités relatives et produira des avertissements spécifiques :

- **Référence Fantôme** : Si l'`@ingrédient` ou la `&variable` cible n'a pas été déclaré(e) précédemment dans la section, le compilateur avertit `RELATIVE_QUANTITY_UNRESOLVED` (ou `VARIABLE_NOT_FOUND`) et affiche `(20 % de manquant ❓)`.
- **Référence Circulaire** : Si un `@ingrédient` essaie de calculer un pourcentage de lui-même (ex : `@farine{10 % @&farine}`), le compilateur avertit `CIRCULAR_REFERENCE` et affiche `(10 % de lui-même) ⚠️`.
- **Masse Cible Inconnue** : Si la masse de la cible ne peut pas être résolue depuis la base de données physique, l'analyseur avertit `RELATIVE_QUANTITY_UNKNOWN_MASS` et laisse la sortie non résolue.

Puisque la valeur d'une quantité relative est toujours dérivée d'un autre ingrédient, elle ne peut pas non plus être utilisée comme [cible de référence pour `--scale`](/fr/docs/how-to/scale-recipes#limits-of-reference-scaling) ou comme base de Pourcentage du Boulanger — voir le [Guide détaillé : Mise à l'échelle](/fr/docs/explanation/scaling) pour l'ensemble complet des règles et codes d'erreur partagés entre les deux.

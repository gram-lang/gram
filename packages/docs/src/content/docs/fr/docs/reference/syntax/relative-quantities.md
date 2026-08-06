---
title: "Quantités Relatives"
description: "Définissez la quantité d'un ingrédient en pourcentage d'un autre ingrédient ou d'une variable pour équilibrer la recette."
---

En cuisine (et particulièrement en pâtisserie), la précision est souveraine. S'appuyer sur des quantités absolues mène parfois à des recettes déséquilibrées, surtout face au rendement variable des produits crus (ex : un citron anormalement juteux).

Gram résout cette équation en vous permettant de définir la quantité d'un `@ingrédient` dynamiquement : en pourcentage d'un autre `@ingrédient` ou d'une `&variable` intermédiaire. La garantie d'une recette inébranlable, peu importe les caprices du réel.

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
| **Portée** | Les cibles relatives sur un `@ingrédient` sont limitées à la `## Section` courante. Pour cibler un composant d'une autre section, passez par une `&variable` globale. |
| **Accumulation** | Si vous déclarez plusieurs fois le même `@ingrédient` dans une `## Section`, le pourcentage s'appliquera sur la **somme cumulée** de ses quantités. |
| **Basé sur la Masse** | Le calcul repose invariablement sur la **masse en grammes**. Par exemple, 50 % de « 2 œufs » (estimés à 50 g l'unité) donnera **50 g**, et non 1 œuf. |

## Règles de Calcul des Masses

Puisque les quantités relatives reposent sur le calcul de pourcentages de masses existantes, l'analyseur (`@gram-lang/analyzer`) standardise les masses avant de calculer :

| Type d'Unité Cible | Logique avant d'appliquer le pourcentage | Exemple |
| :--- | :--- | :--- |
| **Masse Explicite** (g, kg, oz) | Aucune. Calcul direct. | `50 %` de `500 g` = **250 g** |
| **Volume** (ml, L, tasse) | Convertit en grammes en utilisant le champ `physical.density` de l'`@ingrédient` dans la base de données YAML. | 500 ml d'eau ➡️ 500 g.<br/>`50 %` = **250 g** |
| **Nombre** (`@œuf{2}`) | Recherche le champ `physical.unit_weight` moyen dans la base de données YAML. | 2 œufs (50 g l'unité) ➡️ 100 g.<br/>`50 %` = **50 g** |
| **Inconnu** (`1 flasque`) | Ne peut pas deviner. Émet un avertissement `UNKNOWN_MASS`. | Laisse la quantité non résolue. |

## Comportement de la Liste de Courses

Étant donné que les quantités relatives sont de pures formules mathématiques (ex : `125 % du jus de citron`), le compilateur Gram doit arbitrer leur affichage dans la **liste de courses** finale. Sa décision dépend de sa capacité à résoudre la formule pour obtenir une masse physique.

### 1. Entièrement Résolue (Comportement Standard)

Si le compilateur parvient à déterminer la masse physique de la cible (via les règles ci-dessus), il évalue la formule. Le résultat est traité exactement comme une masse fixe et s'agrège de façon transparente à la liste de courses. Vous ne verrez pas les rouages mathématiques : seul le poids d'achat final subsiste.

*Exemple de Liste de Courses :*
```text
- Sucre : 156g
```

### 2. Non Résolue & Sortie Hybride

Il arrive que le compilateur bute sur la formule. C'est le cas si vous avez désactivé la standardisation des masses, ou si la masse de la cible est une impasse (ex : la cible emploie une unité non standardisée comme `1 louche`, ou nécessite une conversion volume-masse mais l'`@ingrédient` manque à l'appel dans `ingredients.yaml`).

Dans ce cas, Gram est incapable de sortir un poids final en grammes. Il bascule alors sur une **sortie hybride**. Il affichera le texte brut de la formule, auquel il greffera proprement toute autre quantité fixe de cet `@ingrédient` trouvée dans la recette.

*Exemple de Liste de Courses (en supposant que la recette utilise aussi un `@sucre{20 g}` fixe ailleurs) :*
```text
- Sucre : 20g + (125 % du jus de citron)
```
Une parade robuste pour ne jamais perdre une exigence d'achat en route, même quand les calculs échouent !

## Gestion des Erreurs

Le compilateur est conçu pour attraper les erreurs de logique dans les quantités relatives et produira des avertissements spécifiques :

- **Référence Fantôme** : Si l'`@ingrédient` ou la `&variable` cible n'a pas été déclaré(e) précédemment dans la section, le compilateur avertit `RELATIVE_QUANTITY_UNRESOLVED` (ou `VARIABLE_NOT_FOUND`) et affiche `(20 % de manquant ❓)`.
- **Référence Circulaire** : Si un `@ingrédient` essaie de calculer un pourcentage de lui-même (ex : `@farine{10 % @&farine}`), le compilateur avertit `CIRCULAR_REFERENCE` et affiche `(10 % de lui-même) ⚠️`.
- **Masse Cible Inconnue** : Si la masse de la cible ne peut pas être résolue depuis la base de données physique, l'analyseur avertit `RELATIVE_QUANTITY_UNKNOWN_MASS` et laisse la sortie non résolue.

Puisque la valeur d'une quantité relative dérive par nature d'un autre ingrédient, elle ne peut logiquement pas servir de [cible de référence pour `--scale`](/fr/docs/how-to/scale-recipes#les-limites-de-la-mise-à-léchelle-par-référence) ni de base de % du Boulanger. Consultez le [Guide détaillé : Mise à l'échelle](/fr/docs/explanation/scaling) pour plonger dans les règles et codes d'erreur qui régissent ces limitations.

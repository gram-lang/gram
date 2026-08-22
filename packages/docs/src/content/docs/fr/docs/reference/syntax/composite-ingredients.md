---
title: "Ingrédients composites"
description: "Regroupez les parties d'un même ingrédient, comme le zeste et le jus, pour que Gram calcule une liste de courses juste."
---

En cuisine, les recettes réclament souvent des parties spécifiques d'un même `@ingrédient` (ex : le **zeste** et le **jus** d'un citron).

Si vous déclarez `@zeste de citron` et `@jus de citron` séparément, votre liste de courses les considèrera comme deux produits distincts. Or, les citrons s'achètent entiers !

C'est là qu'interviennent les **ingrédients composites**. En précisant à Gram que le jus et le zeste proviennent tous deux d'un parent commun `<@citron`, le compilateur peut optimiser mathématiquement votre liste de courses. S'il vous faut le jus de 2 citrons et le zeste d'un seul, Gram déduit qu'ils partagent la même source physique et inscrira exactement **2 citrons entiers** sur votre liste, sans doublon.

## Syntaxe

Un ingrédient composite se déclare via l'opérateur `<` (qui se lit *« provient de »*). Il suffit de l'accoler juste après l'`@ingrédient` enfant.

**Format** : `@nomEnfant{qtéEnfant}<@nomParent{coûtParent}`

- **`nomEnfant{qtéEnfant}`** : La partie spécifique que vous utilisez dans cette étape. Écrivez son **nom complet**, mot du parent inclus (ex : `@jus de citron{100 ml}`), et non un mot générique isolé — voir [Nommer l'enfant](#nommer-lenfant) ci-dessous pour comprendre pourquoi. Comme pour tout `@ingrédient`, `{qtéEnfant}` n'est requis que pour un nom à plusieurs mots.
- **`<@nomParent`** : L'article physique que vous achetez réellement au magasin (ex : `<@citron`).
- **`{coûtParent}`** : *(Optionnel)* La quantité du parent qui est consommée pour obtenir cette partie enfant (ex : `{2}`). Si vous ne l'écrivez pas, la valeur par défaut est `1`.

### Nommer l'enfant

Bien que Gram accepte un enfant en un seul mot (`@jus<@citron{1}`), privilégiez son nom complet (`@jus de citron{}<@citron{1}`). C'est ce nom qui définit l'identité de l'ingrédient dans la base partagée (`ingredients.yaml`), utilisée pour la conversion de masse, la nutrition et `gram db enrich`.

La base de données n'indexant que l'identifiant de l'enfant, un nom générique crée des collisions : un `@jus<@citron` et un `@jus<@orange` dans une autre recette partageraient la même entrée. Utiliser le nom complet (`jus de citron`, `jus d'orange`) évite ce conflit et permet la fusion avec les usages non composites du même ingrédient (ex : une brique de `@jus d'orange{1l}`).

Réservez la forme courte aux ingrédients ponctuels dont vous ne suivez pas les données nutritionnelles. Le compilateur émet un avertissement (`COMPOSITE_PARENT_CONFLICT`) si un même nom court est rattaché à deux parents distincts dans une recette, et `gram db sync` signale ces collisions à l'échelle de toute votre collection.

### Notes de préparation

L'enfant et le parent peuvent chacun porter leur propre note de préparation `()`, de façon indépendante :
- **Préparation de l'enfant** : placée avant le `<` (`@jus de citron{}(filtré)<@citron{1}`).
- **Préparation du parent** : placée après le coût ou le nom du parent (`@jus de citron{}<@citron{1}(coupé en deux)`).

Associez la note à l'élément qu'elle décrit réellement (l'action sur la partie extraite *vs* l'action sur l'ingrédient entier). Les deux peuvent se combiner :

```gram
Ajouter le @jus de citron{150 ml}(filtré)<@citron{1}(coupé en deux) dans le saladier.
```

### Exemple

Voici comment déclarer que 100 ml de jus nécessitent 2 citrons, mais que le zeste ne nécessite qu'un seul citron :

```gram
Ajouter le @jus de citron{100 ml}<@citron{2}.

Puis ajouter le @zeste de citron{1}<@citron. // Coûte implicitement 1 citron
```
**Total requis dans la Liste de Courses** : 2 Citrons.

:::caution[Espacement Strict]
Les espaces sont **strictement interdits** autour de l'opérateur `<`.
- ❌ `@zeste de citron{1} < @citron`
- ✅ `@zeste de citron{1}<@citron`
:::

## Règles de calcul

Comment le compilateur déduit-il le nombre total de citrons à acheter ? Il s'appuie sur trois règles très simples pour optimiser automatiquement la liste de courses.

### 1. La règle de chevauchement (parties différentes)
Si vous utilisez différentes parties d'un même parent (comme le zeste et le jus), Gram sait qu'elles peuvent provenir du même citron physique. Il prend la quantité **maximale** requise parmi ces parties.

```gram
Ajouter le @zeste de citron{1}<@citron.  // Nécessite 1 citron

Ajouter le @jus de citron{1}<@citron.    // Nécessite 1 citron
```
> 🛒 **Liste de Courses** : 1 Citron (Le même citron fournit les deux parties).

### 2. La règle d'addition (même partie)
Si vous utilisez la *même* partie plusieurs fois à travers différentes étapes de votre recette, Gram les additionne. Vous ne pouvez pas magiquement obtenir deux zestes à partir d'un seul citron !

```gram
Ajouter le @zeste de citron{1}<@citron.  // Nécessite 1 citron

Ajouter le @zeste de citron{1}<@citron.  // Nécessite un autre citron
```
> 🛒 **Liste de Courses** : 2 Citrons.

### 3. Agrégation de l'utilisation directe
Si vous utilisez également l'ingrédient parent entier directement (ex : couper un citron entier en quartiers pour décorer), Gram l'ajoute simplement au total optimisé.

```gram
Ajouter le @zeste de citron{1}<@citron.  // Couvert par le 1er citron

Ajouter le @jus de citron{1}<@citron.    // Couvert par le 1er citron

Couper le @citron{2} en quartiers.       // Nécessite 2 citrons entiers
```
> 🛒 **Liste de Courses** : 3 Citrons.

## Sortie de la liste de courses

La structure de la liste de courses générée prend nativement en charge ces ingrédients composites, ce qui permet aux applications *front-end* de les afficher sous forme de hiérarchie.

Pour l'exemple ci-dessus, la sortie JSON ressemblerait à ceci :

```json
{
  "type": "composite",
  "id": "citron",
  "name": "citron",
  "qty": 3,
  "usage": [
    { "id": "zeste-de-citron", "qty": 1 },
    { "id": "jus-de-citron", "qty": 1 },
    { "id": "citron", "qty": 2, "alias": "Direct Use" }
  ]
}
```

## Listes d'ingrédients de section

À l'inverse de la liste de courses globale, la liste d'ingrédients spécifique à une section reste plate. Néanmoins, elle mentionne clairement de quel parent provient un enfant composite (l'info est ajoutée entre parenthèses juste après le nom de l'enfant) :

```md
**Ingrédients** :
- **zeste de citron** (citron)
- **jus de citron** (citron)
```

Cette parenthèse fonctionne de la même façon quel que soit le nom donné à l'enfant — c'est elle qui garde un nom court (`@zeste`, `@jus`) traçable vers son parent si vous en utilisez un. Mais ce n'est qu'une aide d'*affichage* : elle ne change rien à l'identité de l'enfant dans la base de données, ce qui explique pourquoi le nom complet reste le choix par défaut le plus sûr (voir [Nommer l'enfant](#nommer-lenfant) ci-dessus).

Si le parent lui-même a aussi une préparation `()` (ex : `@jus de citron{150 ml}<@citron{1}(coupé en deux)`), elle est repliée dans la même parenthèse, après le nom du parent :

```md
**Ingrédients** :
- **jus de citron** (citron, coupé en deux)
```

Notez que la préparation du parent n'apparaîtra **jamais** dans la liste de courses globale : au même titre que n'importe quelle autre note de préparation, il s'agit d'une consigne de recette, et non d'un attribut d'achat.

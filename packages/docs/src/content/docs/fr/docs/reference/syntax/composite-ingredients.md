---
title: "Ingrédients Composites"
description: "Regroupez les parties d'un même ingrédient, comme le zeste et le jus, pour que Gram calcule une liste de courses juste."
---

En cuisine, les recettes réclament souvent des parties spécifiques d'un même `@ingrédient` (ex : le **zeste** et le **jus** d'un citron).

Si vous déclarez `@zeste de citron` et `@jus de citron` séparément, votre liste de courses les considèrera comme deux produits distincts. Or, les citrons s'achètent entiers !

C'est là qu'interviennent les **ingrédients composites**. En précisant à Gram que le jus et le zeste proviennent tous deux d'un parent commun `<@citron`, le compilateur peut optimiser mathématiquement votre liste de courses. S'il vous faut le jus de 2 citrons et le zeste d'un seul, Gram déduit qu'ils partagent la même source physique et inscrira exactement **2 citrons entiers** sur votre liste, sans doublon.

## Syntaxe

Un ingrédient composite se déclare via l'opérateur `<` (qui se lit *« provient de »*). Il suffit de l'accoler juste après l'`@ingrédient` enfant.

**Format** : `@nomEnfant{qtéEnfant}<@nomParent{coûtParent}`

- **`nomEnfant{qtéEnfant}`** : La partie spécifique que vous utilisez dans cette étape (ex : `@jus de citron{100 ml}`). Comme pour tout `@ingrédient`, `{qtéEnfant}` n'est requis que pour un nom à plusieurs mots — un enfant en un seul mot (ex : `@jus`) peut s'en passer complètement : `@jus<@citron{1}`.
- **`<@nomParent`** : L'article physique que vous achetez réellement au magasin (ex : `<@citron`).
- **`{coûtParent}`** : *(Optionnel)* La quantité du parent qui est consommée pour obtenir cette partie enfant (ex : `{2}`). Si vous ne l'écrivez pas, la valeur par défaut est `1`.

L'enfant comme le parent peuvent chacun porter leur propre note de préparation `()`, et ce de manière totalement indépendante :
- **La préparation de l'enfant** se place juste après son nom (et sa quantité, le cas échéant), avant le `<` : `@jus(filtré)<@citron{1}`.
- **La préparation du parent** se place juste après son coût (ou son nom, si le coût est omis) : `@jus<@citron{1}(coupé en deux)`.

Accrochez toujours la préparation à l'élément qu'elle qualifie réellement (l'action subie par la partie extraite *vs* l'action subie par l'ingrédient entier). Les deux peuvent bien sûr se combiner :

```gram
Ajouter le @jus{150 ml}(filtré)<@citron{1}(coupé en deux) dans le saladier.
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

## Règles de Calcul

Comment le compilateur déduit-il le nombre total de citrons à acheter ? Il s'appuie sur trois règles très simples pour optimiser automatiquement la liste de courses.

### 1. La Règle de Chevauchement (Parties Différentes)
Si vous utilisez différentes parties d'un même parent (comme le zeste et le jus), Gram sait qu'elles peuvent provenir du même citron physique. Il prend la quantité **maximale** requise parmi ces parties.

```gram
Ajouter le @zeste de citron{1}<@citron.  // Nécessite 1 citron

Ajouter le @jus de citron{1}<@citron.    // Nécessite 1 citron
```
> 🛒 **Liste de Courses** : 1 Citron (Le même citron fournit les deux parties).

### 2. La Règle d'Addition (Même Partie)
Si vous utilisez la *même* partie plusieurs fois à travers différentes étapes de votre recette, Gram les additionne. Vous ne pouvez pas magiquement obtenir deux zestes à partir d'un seul citron !

```gram
Ajouter le @zeste de citron{1}<@citron.  // Nécessite 1 citron

Ajouter le @zeste de citron{1}<@citron.  // Nécessite un autre citron
```
> 🛒 **Liste de Courses** : 2 Citrons.

### 3. Agrégation de l'Utilisation Directe
Si vous utilisez également l'ingrédient parent entier directement (ex : couper un citron entier en quartiers pour décorer), Gram l'ajoute simplement au total optimisé.

```gram
Ajouter le @zeste{1}<@citron.  // Couvert par le 1er citron

Ajouter le @jus{1}<@citron.    // Couvert par le 1er citron

Couper le @citron{2} en quartiers.       // Nécessite 2 citrons entiers
```
> 🛒 **Liste de Courses** : 3 Citrons.

## Sortie de la Liste de Courses

La structure de la liste de courses générée prend nativement en charge ces ingrédients composites, ce qui permet aux applications *front-end* de les afficher sous forme de hiérarchie.

Pour l'exemple ci-dessus, la sortie JSON ressemblerait à ceci :

```json
{
  "type": "composite",
  "id": "citron",
  "name": "citron",
  "qty": 3,
  "usage": [
    { "id": "zeste", "qty": 1 },
    { "id": "jus", "qty": 1 },
    { "id": "citron", "qty": 2, "alias": "Direct Use" }
  ]
}
```

## Listes d'Ingrédients de Section

À l'inverse de la liste de courses globale, la liste d'ingrédients spécifique à une section reste plate. Néanmoins, elle mentionne clairement de quel parent provient un enfant composite (l'info est ajoutée entre parenthèses juste après le nom de l'enfant) :

```md
**Ingrédients** :
- **zeste** (citron)
- **jus** (citron)
```

Cette astuce permet d'utiliser des noms raccourcis pour les enfants composites (`@zeste`, `@jus`) sans jamais perdre leur traçabilité vers l'ingrédient parent.

Si le parent lui-même a aussi une préparation `()` (ex : `@jus{150 ml}<@citron{1}(coupé en deux)`), elle est repliée dans la même parenthèse, après le nom du parent :

```md
**Ingrédients** :
- **jus** (citron, coupé en deux)
```

Notez que la préparation du parent n'apparaîtra **jamais** dans la liste de courses globale : au même titre que n'importe quelle autre note de préparation, il s'agit d'une consigne de recette, et non d'un attribut d'achat.

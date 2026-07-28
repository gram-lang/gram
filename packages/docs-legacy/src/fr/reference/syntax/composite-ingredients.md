# Ingrédients Composites

Dans la vraie cuisine, les recettes nécessitent souvent des parties spécifiques d'un `@ingrédient` — comme le **zeste** et le **jus** d'un citron.

Si vous écrivez `@zeste de citron` et `@jus de citron` séparément, votre liste de courses les traitera comme deux produits complètement différents. Mais les citrons s'achètent entiers !

Pour résoudre cela, Gram introduit les **Ingrédients Composites**. En indiquant à Gram que le jus et le zeste proviennent tous les deux d'un parent `<@citron`, le compilateur peut optimiser mathématiquement votre liste de courses. Si vous avez besoin du jus de 2 citrons et du zeste d'un citron, Gram comprend qu'ils partagent la même source physique et ajoutera intelligemment exactement **2 citrons entiers** à votre liste de courses.

## Syntaxe

Vous définissez un ingrédient composite en utilisant l'opérateur `<` (qui peut se lire *"provient de"*). Vous l'ajoutez simplement juste après l'`@ingrédient` enfant.

**Format** : `@nomEnfant{qtéEnfant}<@nomParent{coûtParent}`

- **`nomEnfant{qtéEnfant}`** : La partie spécifique que vous utilisez dans cette étape (ex : `@jus de citron{100 ml}`). Comme pour tout `@ingrédient`, `{qtéEnfant}` n'est requis que pour un nom à plusieurs mots — un enfant en un seul mot (ex : `@jus`) peut s'en passer complètement : `@jus<@citron{1}`.
- **`<@nomParent`** : L'article physique que vous achetez réellement au magasin (ex : `<@citron`).
- **`{coûtParent}`** : *(Optionnel)* La quantité du parent qui est consommée pour obtenir cette partie enfant (ex : `{2}`). Si vous ne l'écrivez pas, la valeur par défaut est `1`.

L'enfant comme le parent peuvent chacun porter leur propre note de préparation `()`, de manière indépendante :
- **La préparation de l'enfant** se place juste après son nom (et sa quantité, le cas échéant), avant le `<` : `@jus(filtré)<@citron{1}`.
- **La préparation du parent** se place juste après son coût (ou son nom, si le coût est omis) : `@jus<@citron{1}(coupé en deux)`.

Rattachez la préparation à l'élément qu'elle décrit réellement (ce qui est fait à la partie extraite vs ce qui est fait à l'ingrédient entier). Les deux peuvent également se combiner si nécessaire :

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

::: warning Espacement Strict
Les espaces sont **strictement interdits** autour de l'opérateur `<`.
- ❌ `@zeste de citron{1} < @citron`
- ✅ `@zeste de citron{1}<@citron`
:::

## Règles de Calcul

Comment le compilateur calcule-t-il réellement le nombre total de citrons que vous devez acheter ? Il utilise trois règles simples pour optimiser automatiquement votre liste de courses.

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

La structure de la liste de courses générée gère élégamment les ingrédients composites, permettant aux applications front-end de les afficher de manière hiérarchique.

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

Contrairement à la liste de courses, la liste d'ingrédients propre à une section reste plate — mais elle indique tout de même de quel parent provient un enfant composite, ajouté entre parenthèses juste après le nom de l'enfant :

```md
**Ingrédients** :
- **zeste** (citron)
- **jus** (citron)
```

Cela permet d'écrire des noms courts pour les enfants composites (`@zeste`, `@jus`) sans perdre la traçabilité vers le parent.

Si le parent lui-même a aussi une préparation `()` (ex : `@jus{150 ml}<@citron{1}(coupé en deux)`), elle est repliée dans la même parenthèse, après le nom du parent :

```md
**Ingrédients** :
- **jus** (citron, coupé en deux)
```

La préparation du parent n'apparaît jamais dans la liste de courses — comme toute autre note de préparation, c'est une information pour la recette, pas un attribut de liste de courses.

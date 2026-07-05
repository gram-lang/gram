# Ingrédients Composites

Dans la vraie cuisine, les recettes nécessitent souvent des parties spécifiques d'un `@ingrédient` — comme le **zeste** et le **jus** d'un citron.

Si vous écrivez `@zeste de citron` et `@jus de citron` séparément, votre liste de courses les traitera comme deux produits complètement différents. Mais les citrons s'achètent entiers !

Pour résoudre cela, Gram introduit les **Ingrédients Composites**. En indiquant à Gram que le jus et le zeste proviennent tous les deux d'un parent `<@citron`, le compilateur peut optimiser mathématiquement votre liste de courses. Si vous avez besoin du jus de 2 citrons et du zeste d'un citron, Gram comprend qu'ils partagent la même source physique et ajoutera intelligemment exactement **2 citrons entiers** à votre liste de courses.

## Syntaxe

Vous définissez un ingrédient composite en utilisant l'opérateur `<` (qui peut se lire *"provient de"*). Vous l'ajoutez simplement juste après l'`@ingrédient` enfant.

**Format** : `@nomEnfant{qtéEnfant}<@nomParent{coûtParent}`

- **`nomEnfant{qtéEnfant}`** : La partie spécifique que vous utilisez dans cette étape (ex : `@jus de citron{100 ml}`).
- **`<@nomParent`** : L'article physique que vous achetez réellement au magasin (ex : `<@citron`).
- **`{coûtParent}`** : *(Optionnel)* La quantité du parent qui est consommée pour obtenir cette partie enfant (ex : `{2}`). Si vous ne l'écrivez pas, la valeur par défaut est `1`.

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
Ajouter le @zeste de citron{1}<@citron.  // Couvert par le 1er citron

Ajouter le @jus de citron{1}<@citron.    // Couvert par le 1er citron

Couper les @citrons{2} en quartiers.     // Nécessite 2 citrons entiers
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
    { "id": "zeste de citron", "unit": null, "qty": 1, "alias": "zeste de citron" },
    { "id": "jus de citron", "unit": null, "qty": 1, "alias": "jus de citron" },
    { "id": "citron", "unit": null, "qty": 2, "alias": "Direct Use" }
  ]
}
```

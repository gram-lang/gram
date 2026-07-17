# Analyse approfondie : Agrégation de la Liste de Courses

Lorsque le paquet `@gram-lang/kitchen` traite un Arbre Syntaxique Abstrait (AST), l'une de ses responsabilités principales est la génération de la liste de courses. 

Il ne s'agit pas d'une simple concaténation d'ingrédients. Le compilateur effectue un processus d'agrégation complexe pour garantir que la liste est physiquement exacte et optimisée pour les achats.

## Le Pipeline d'Agrégation

Lorsqu'une recette (ou un lot de plusieurs recettes) est transmise à la Kitchen pour la génération de la liste de courses, le pipeline suivant s'exécute :

### 1. Normalisation des ID et Alias
`@gram-lang/kitchen` en lui-même regroupe les ingrédients purement par l'id brut qu'il a attribué lors de l'analyse (un slug du nom que vous avez écrit) — il n'a pas accès à `ingredients.yaml` et ne peut pas savoir que `@butter` et `@beurre` font référence au même ingrédient. En soi, la liste de courses de la Kitchen les liste comme deux entrées séparées.

La résolution des alias se produit une couche au-dessus, dans `@gram-lang/analyzer`, qui a accès à la base de données des ingrédients. Si `beurre` est listé comme un alias de `butter` dans `ingredients.yaml`, l'analyseur regroupe les entrées brutes de la Kitchen sous cet id canonique, fusionnant `@butter` et `@beurre` en une seule entrée `butter`. **Cette étape ne s'exécute que lorsqu'une base de données d'ingrédients est fournie** — sans elle (compilation avec `@gram-lang/kitchen` seul, ou une commande CLI lancée sans base de données), les alias ne sont pas résolus et les deux ingrédients restent séparés.

### 2. Fusion des Unités
Si les ingrédients regroupés partagent la même unité (ex : `100 g` et `50 g`), ils sont simplement additionnés (`150 g`) — cela se produit directement dans `@gram-lang/kitchen`, sans avoir besoin de base de données.

S'ils ont des unités différentes (ex : `100 g` et `1 tasse`), les additionner nécessite une conversion via la masse, ce qui — tout comme la résolution des alias — dépend de la base de données d'ingrédients et se produit donc dans `@gram-lang/analyzer`. Si chaque quantité contributrice se résout en une masse (densité connue, depuis la BDD ou une surcharge au niveau de la recette), l'analyseur les convertit toutes en grammes et les fusionne en une seule entrée.

**Repli : densité manquante.** Si la densité ne peut pas être résolue pour au moins l'une des unités impliquées, l'analyseur ne peut pas produire un total de masse unique et fiable. Plutôt que de deviner, il garde les entrées séparées, les renomme avec l'id canonique, et les marque toutes avec `multiUnit: true`. Les moteurs de rendu utilisent cet indicateur pour regrouper les entrées sous un même en-tête (ex : "⚠️ Unités mixtes") au lieu de les éparpiller dans la liste — ce qui rend clair pour le cuisinier qu'il s'agit du même ingrédient, sans additionner silencieusement des unités incompatibles.

::: tip Id canonique vs. nom affiché
L'id canonique (ex : `butter`) n'existe que pour permettre le regroupement et la fusion des entrées — c'est une clé interne, pas le libellé montré au cuisinier. Le **nom** affiché dans une entrée de la liste de courses suit une seule règle, appliquée à l'identique partout (le Playground, `gram view`, `gram shop`, `gram export`) :

| Ce que vous écrivez | ID Canonique trouvé | `name` dans la base | Nom affiché dans la liste | Pourquoi ? |
| --- | --- | --- | --- | --- |
| `@flour` | `flour` (Direct) | Wheat Flour | **Wheat Flour** | Correspondance directe = on utilise le nom enrichi de la base. |
| `@farine` (FR) | `flour` (Alias) | Wheat Flour | **farine** | Alias = on garde le mot de la recette pour préserver sa langue. |
| `@harina` (ES) | `flour` (Alias) | Wheat Flour | **harina** | L'astuce fonctionne avec n'importe quelle langue configurée dans vos alias. |
| `@poussière` | *Aucun* | *Aucun* | **poussière** | Inconnu = on garde le mot de la recette. |

C'est ce qui permet à un écosystème Gram d'être véritablement international. Que vous écriviez une recette en français, en espagnol ou en allemand et que vous la compiliez avec une base de données mondiale maintenue en anglais, votre liste de courses conservera toujours votre terminologie locale (`farine`, `harina`, `Mehl`). Pendant ce temps, les recettes utilisant le vocabulaire natif de la base bénéficieront de noms enrichis.

**Pas de base de données, ou pas d'entrée correspondante ?** Il n'y a alors tout simplement aucun `name` canonique à préférer, donc le mot de la recette est toujours utilisé — cela fonctionne avec une base vide (`{}`), une base qui n'a aucune entrée pour cet ingrédient, et avec `compile()` de `@gram-lang/kitchen` utilisé seul, sans jamais appeler `@gram-lang/analyzer`.
:::

### 3. Masquage (Ghosting) des Quantités Relatives
Les quantités relatives (comme `@eau{50 % @&farine}`) posent un problème unique pour les listes de courses, en particulier lors du traitement par lots de multiples recettes. 

Si vous mettez le lot à l'échelle, la quantité d'eau dépend d'une quantité de farine qui pourrait appartenir à une recette spécifique. Pour éviter des paradoxes mathématiques, la Kitchen **masque (ghost)** les quantités relatives dans la liste de courses. Cela signifie qu'elles sont exclues de l'agrégation principale et listées séparément en tant que dépendances non résolvables, garantissant que les poids statiques restent mathématiquement purs.

### 4. Résolution des Composites (MAX vs SUM)
La partie la plus complexe du pipeline d'agrégation est la gestion des Ingrédients Composites (`<@`). 

Lorsque plusieurs enfants pointent vers le même parent, le compilateur utilise deux règles distinctes pour déterminer combien de parents vous devez acheter :

1. **La Règle du MAX (Non-Destructrice)** : 
   Si les enfants utilisent des *parties différentes* du parent (ex : le jus de citron et le zeste de citron), vous n'avez pas besoin de deux citrons. Le compilateur prend l'équivalent maximal en masse du parent requis par l'un ou l'autre des enfants. Si vous avez besoin de jus pour 3 citrons, mais de zeste pour seulement 1 citron, la liste de courses indiquera `3 citrons`.
2. **La Règle du SUM (Somme - Destructrice)** :
   Si les enfants utilisent la *même partie* du parent (ex : du blanc de poulet pour une salade, et du blanc de poulet pour une soupe), vous ne pouvez pas réutiliser le même poulet. Le compilateur additionne les masses équivalentes de parents requises par les deux enfants.

## La Sortie Finale
Le résultat est un tableau d'objets `ShoppingItem` hautement optimisé, dédupliqué et mathématiquement exact, regroupé par catégories culinaires, prêt à être affiché dans le terminal ou sur une interface web.

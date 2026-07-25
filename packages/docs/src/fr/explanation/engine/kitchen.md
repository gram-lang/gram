# Compilation (`@gram-lang/kitchen`)

Si `@gram-lang/parser` fournit le vocabulaire, `@gram-lang/kitchen` fournit la logique.

Le paquet Kitchen prend l'AST (Arbre Syntaxique Abstrait) généré par l'analyseur (parser) et le "compile". Il est responsable de la simulation de l'exécution de la recette de haut en bas, de la résolution des variables, du calcul des métriques de temps, et de la génération de la liste de courses finale.

## Responsabilités Principales

Le processus de compilation (orchestré par `core.ts`) est réparti sur plusieurs modules :

### 1. Portée Structurelle & Traitement (`processor.ts`)

Le processeur parcourt chaque section et étape de l'AST séquentiellement pour construire la chronologie d'exécution.

- **Résolution de Variables** : Lorsqu'il rencontre une déclaration intermédiaire (`->&pâte`), il l'enregistre dans la Portée Globale. Lorsqu'il rencontre une référence (`&pâte`), il la relie à sa déclaration.
- **Diagnostics** : Le processeur a pour mission d'attraper les erreurs logiques — en plaçant des objets `Warning` structurés dans `CompilationResult.warnings` plutôt qu'en levant des exceptions, afin que les appelants puissent afficher un rendu partiel tout en signalant les problèmes. Si vous référencez `&pâte` sans l'avoir déclarée, il émet un avertissement `UNDEFINED_REFERENCE`. Les références circulaires indirectes à plusieurs sauts (`&a -> &b -> &a`) sont détectées par un parcours DFS dans `graph.ts` et remontées via `CIRCULAR_REFERENCE` (`warn-016`). Avec `gram check --strict`, les avertissements sont promus en codes de sortie bloquants.
- **Génération de la Chronologie (Ordonnancement ALAP)** : Le moteur utilise un algorithme d'ordonnancement **ALAP (As Late As Possible)** (découpé en modules sous `src/schedule/` pour la testabilité unitaire) à travers une compilation en quatre phases pour générer une chronologie d'exécution hautement optimisée.
  - **Phase 1 (Forward Pass)** : Le compilateur estime les durées et les tâches de fond passives pour déterminer le temps nécessaire à la production des préparations intermédiaires (`->&nom`) au sein de chaque section.
  - **Phase 2 (Backward Pass)** : Il parcourt la recette à l'envers (`alap.ts`). Lorsqu'une étape consomme un intermédiaire (`&nom`), le moteur enregistre cette dépendance pour trouver l'heure limite la plus tardive à laquelle il doit être prêt. Il traite également les ancres explicites de rétro-planning de section (`~{-1j}`). L'étape qui produit l'intermédiaire est alors ordonnancée *juste-à-temps* pour se terminer exactement au moment voulu.
  - **Phase 3 (Serialization)** : Le moteur évalue la logique des "Named Tracks" (`tracks.ts`), garantissant que les minuteurs de fond séquentiels partageant le même nom (ex. `~_four`) ne se chevauchent pas, ajustant leurs heures de début chronologiquement pour éviter les conflits (contention).
  - **Phase 4 (Positive Rebasing)** : Enfin (`rebase.ts`), si l'une des étapes a été repoussée dans un temps négatif (par ex. commencer un jour avant de servir), la chronologie entière est décalée vers l'avant de la valeur absolue de l'heure de début minimale (T-Zéro). Cela garantit que la structure de données de la chronologie finale (`timings`) ne contient strictement que des temps absolus positifs commençant exactement à 0, la rendant facilement exploitable par les interfaces utilisateur.

  ::: tip
  La flèche `👉` que vous voyez dans les recettes rendues (ex : `👉*pâte*`) est une icône d'affichage ajoutée par `@gram-lang/renderer`, pas de la syntaxe Gram. Dans le code source `.gram`, un intermédiaire est consommé avec un simple `&nom`.
  :::

### 2. Métriques de Temps (`metrics.ts` / `processor.ts`)

La Kitchen calcule quatre métriques de temps, combinées dans `core.ts` :
- **Temps Actif (`activeTime`)** : La somme de toutes les durées des minuteurs actifs, plus un défaut de 2 minutes pour toute étape qui ne déclare aucun minuteur.
- **Temps de Cuisson (`cookTime`)** : Le temps de fin absolu maximal de la chronologie de cuisson, en tenant compte de toute tâche de fond passive (comme faire reposer une pâte pendant 24 heures) qui se termine après la dernière étape active.
- **Temps de Préparation (`preparationTime`)** : *Indépendant des minuteurs.* Il calcule le temps nécessaire à la *mise en place* en ajoutant 1 minute pour chaque ingrédient/matériel unique (suivi dans le registre), plus 2 minutes supplémentaires pour chaque ingrédient ou matériel nécessitant une note de préparation (ex : `@oignon(épluché et haché)`).
- **Temps Total (`totalTime`)** : `preparationTime + cookTime` — l'investissement en temps réaliste et complet, du rassemblement des ingrédients jusqu'au plat prêt.

### 3. Agrégation de la Liste de Courses (`shopping.ts`)

La Kitchen construit la liste de base des ingrédients nécessaires pour cuisiner la recette.

- **Fusion** : Elle regroupe toutes les utilisations d'un ingrédient par son id brut (un slug du nom tel qu'il est écrit) et son unité. Si vous utilisez `@beurre{50 g}` dans la pâte et `@beurre{20 g}` dans le glaçage, elle les somme arithmétiquement en une seule entrée de `70 g`.
- **Logique des Composites** : Elle implémente les règles MAX et SUM (somme) pour les [Ingrédients Composites](../syntax/composite-ingredients.md) : la quantité parent requise par tous les enfants composites est calculée via le MAX (ex : le plus grand entre "zeste de 2 citrons" et "jus de 3 citrons" l'emporte), puis toute quantité du parent utilisée directement pour lui-même est SOMMÉE par-dessus.
- **Agrégation Hybride** : Elle gère les [Quantités Relatives](../syntax/relative-quantities.md) en gardant les quantités basées sur des formules/non résolues séparées (sous forme de texte, marquées pour révision) des masses numériques absolues, de sorte que la liste de courses reste mathématiquement exacte même si les portions changent.

::: tip Ceci n'est pas la liste finale
La Kitchen n'a pas accès à `ingredients.yaml` — elle regroupe purement par id brut, donc `@butter` et `@beurre` (un alias du même ingrédient) restent séparés ici, et `100 g` + `1 tasse` du même ingrédient restent sous forme de deux entrées plutôt qu'une masse fusionnée. Cette résolution plus poussée — alias de l'id canonique et fusion inter-unités via la densité — a lieu en aval dans `@gram-lang/analyzer`, une fois qu'une base de données d'ingrédients est disponible. Voir [Agrégation de la Liste de Courses](../shopping-list-aggregation.md).
:::

::: tip Une deuxième agrégation, différente, existe par section
`section.ts` fournit un utilitaire séparé, `aggregateSectionIngredients`, utilisé pour construire un affichage compact des ingrédients *au sein d'une seule section* (contrairement à la liste de courses globale ci-dessus). Ses règles sont délibérément différentes : les quantités mesurées du même ingrédient ne sont **pas** additionnées arithmétiquement — elles sont conservées côte à côte et jointes pour l'affichage (ex : `200g + 50g`), puisqu'une liste par section est censée montrer ce qui est utilisé à chaque étape, et non un total unique d'achat.
:::

## Sortie

La sortie de `@gram-lang/kitchen` est un objet `CompilationResult` (c'est la "recette compilée" à laquelle il est fait référence ailleurs dans la documentation). Il est structurellement sain et mathématiquement agrégé, mais il n'est **pas encore physiquement exact**.

Par exemple, la Kitchen sait que vous avez besoin d'une `1 tasse` de farine et de `2 tasses` de sucre, mais elle ne sait pas quel est le poids d'une tasse de farine. Cet enrichissement physique a lieu à l'étape suivante : l'**Analyseur** (Analyzer).

## Autres Responsabilités

- **Mise à l'Échelle de la Recette (Scaling)** : Si une option de compilation `scaleFactor` est fournie, toutes les quantités dans le résultat sont mises à l'échelle proportionnellement — sauf les quantités marquées comme fixes avec `=` (ex : `@sel{=5g}`, censé rester constant quelle que soit la taille du lot) et les quantités en texte libre, qui ne peuvent pas être mises à l'échelle numériquement.
- **Validation des Pourcentages du Boulanger** : Le compilateur applique la règle selon laquelle au plus un ingrédient par recette peut porter le modificateur de pourcentage du boulanger (`*`), sinon il lève une erreur.

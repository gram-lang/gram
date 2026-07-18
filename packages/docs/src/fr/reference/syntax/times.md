# Temps & Planification

Vous pouvez définir des minuteurs (`~minuteur`) et des durées dans vos recettes à l'aide du symbole `~`.

## Déclaration de Base

Un `~minuteur` **doit** spécifier une unité à l'intérieur des accolades. Un texte imprécis comme `~{environ 10 minutes}` est invalide.

```gram
Cuire pendant ~{25 min}.
```

**Unités supportées :**
- `min` (minutes) - Standard recommandé.
- `h` (heures).
- `d` (jours).
- `s` (secondes).

> **Note :** `m` ou `minutes` seront automatiquement corrigés en `min` par le compilateur.

Ces unités sont résolues via le dictionnaire de temps multilingue de Gram : les alias localisés ci-dessous sont donc également reconnus pour un `~minuteur`, quelle que soit la langue de rédaction de la recette (ex : `~{2j}` fonctionne exactement comme `~{2d}`).

<!--@include: ../../../reference/api/parts/fr/time-units.md-->

### Noms de Minuteur
Vous pouvez attribuer un nom spécifique à un `~minuteur`. C'est particulièrement utile pour les tâches passives : lorsque plusieurs `~minuteurs` s'exécutent en parallèle (comme une pâte qui repose pendant qu'une sauce mijote), les noms permettent aux outils et aux interfaces d'affichage de les identifier et de les suivre clairement de manière simultanée.

```gram
Faire bouillir les @œufs{2} pendant ~œufs{3 min}.
```

### Plages (Intervalles)
Vous pouvez spécifier une plage de temps si la durée est une estimation.

```gram
Cuire au four pendant ~{30-40 min}.
```
::: tip
Pour les calculs globaux de la ligne du temps (durée totale de la recette), le compilateur utilise automatiquement la moyenne de la plage (ici, 35 minutes).
:::

## Actif vs Passif

Le compilateur Gram construit une ligne du temps complète (similaire à un diagramme de Gantt) de l'exécution de votre recette. Pour le faire avec précision, il a besoin de savoir si un `~minuteur` nécessite votre attention complète ou s'il s'exécute en arrière-plan.

::: tip 💡 La Règle d'Or : Est-ce que cette étape VOUS empêche de commencer l'étape suivante ?

| Votre Statut | Type de Minuteur | Syntaxe | Exemples |
| :--- | :--- | :--- | :--- |
| **OUI** (Attention manuelle requise) | **Actif** | `~` | *Fouetter à la main, remuer un risotto* |
| **NON** (Une machine/le temps fait le travail) | **Passif** | `~_` | *Cuisson au four, repos, robot pâtissier* |

:::

### Actif (Par défaut)
Par défaut, un `~minuteur` est actif. Cela implique que vous travaillez activement et cela **bloque** le flux de travail. Vous devez terminer cette étape avant de pouvoir faire autre chose.

```gram
Fouetter la @crème liquide{} en continu pendant ~{5 min}.
```
> ⏱️ **Résultat :** Ajoute 5 minutes au **Temps Actif**.

### Passif (`_`)
Utilisez le modificateur `_` pour rendre un `~minuteur` passif. C'est une **tâche en arrière-plan**. Vous démarrez le `~minuteur` (ex : mettre un plat au four) et passez immédiatement à l'étape suivante.

```gram
Cuire dans le #four pendant ~_{45 min}.

Pendant ce temps, préparer le glaçage...
```
> ⏱️ **Résultat :** N'ajoute aucune (0) minute au Temps Actif, mais garantit que le **Temps de Cuisson** est prolongé pour couvrir cette attente de 45 minutes.

## Comment le Temps est Calculé

En coulisses, Gram calcule quatre métriques de temps distinctes pour vous donner un planning de cuisine réaliste.

::: info ⏱️ Les 4 Métriques de Temps
1. **Temps de Préparation** (Mise-en-place) : Temps nécessaire *avant* de commencer l'étape 1 (rassembler les ingrédients, éplucher, couper).
2. **Temps Actif** : Temps passé à travailler activement pendant les étapes de la recette (les mains occupées).
3. **Temps de Cuisson** : Le temps absolu du flux de la recette, de l'étape 1 jusqu'à la fin (incluant l'attente passive).
4. **Temps Total** : La somme du Temps de Préparation + Temps de Cuisson. C'est le "temps passé en cuisine" réaliste.
:::

### Antisèche : Qu'est-ce qui ajoute du temps ?

Voici une décomposition concrète de la manière dont le compilateur calcule automatiquement les minutes en fonction de votre syntaxe :

| Syntaxe / Scénario | Ajoute au Temps de Préparation | Ajoute au Temps Actif | Ajoute au Temps de Cuisson | Ajoute au Temps Total |
| :--- | :--- | :--- | :--- | :--- |
| **Nouvel Ingrédient** (`@farine`) | **+ 1 min** | - | - | **+ 1 min** |
| **Préparation courte** (`@oignon(épluché)`) | **+ 2 min** | - | - | **+ 2 min** |
| **Minuteur Actif** (`~{10 min}`) | - | **+ 10 min** | **+ 10 min** | **+ 10 min** |
| **Minuteur Passif** (`~_{1 h}`) | - | - | **+ 1 heure** (en arrière-plan) | **+ 1 heure** |
| **Étape sans aucun minuteur** | - | **+ 2 min** (valeur par défaut) | **+ 2 min** | **+ 2 min** |

### Suivi Intelligent des Dépendances
Vous n'avez pas besoin de faire des mathématiques complexes ! Si vous déclarez une pâte qui repose pendant `~_{1 h}` en arrière-plan, et qu'une étape ultérieure requiert cette `&pâte`, le compilateur va automatiquement "mettre en pause" la ligne du temps et attendre que l'heure se termine avant de commencer cette étape.

## Rétroplanning de Section

Vous pouvez assigner un délai de préparation à une `## Section` en ajoutant une annotation `~{...}` à son titre. Cela indique au compilateur quand cette section doit démarrer par rapport au reste de la recette — utile pour tout ce qui nécessite une préparation à l'avance (une pâte qui repose une nuit, un fond préparé deux jours avant), et suffisamment structuré pour alimenter de futurs outils comme des vues façon diagramme de Gantt.

```gram
## Pâte Feuilletée ~{-2j}
```

Cela signifie que la section "Pâte Feuilletée" doit être préparée **2 jours à l'avance**.

### Syntaxe stricte

Contrairement à du texte libre, `~{...}` sur un titre de section exige un nombre **strictement négatif** suivi d'une unité — puisque cette annotation sert spécifiquement à indiquer combien de temps *à l'avance* la section doit être préparée, une valeur nulle ou positive n'aurait pas de sens ici :

- Un `-` **obligatoire** en préfixe (l'anticipation est tout l'intérêt du rétroplanning).
- Un nombre non nul.
- Une unité : `d` (jours), `h` (heures), ou `min` (minutes) — les mêmes unités canoniques que la version anglaise ; voir la note ci-dessous sur les alias localisés comme `j`.

```gram
## Pâte Feuilletée ~{-2j}   <!-- 2 jours avant -->
## Ganache ~{-30min}        <!-- 30 minutes avant -->
```

Un texte libre (ex : `~{la veille}`/`~{the day before}`), une valeur non signée ou positive (ex : `~{2h}`), et une valeur nulle (ex : `~{0h}` ou `~{-0h}`) ne sont **plus valides** pour cette annotation — écrivez `~{-1j}` à la place. Les recettes existantes utilisant l'une de ces formes continuent de compiler, mais le compilateur les signale désormais comme décrit ci-dessous.

L'unité est résolue via le même dictionnaire de temps multilingue que celui utilisé par `~minuteur` (voir [Déclaration de Base](#declaration-de-base)) : `j`, `jour` et `jours` sont tous reconnus comme alias de l'unité canonique `d` (jour), quelle que soit la langue de rédaction de la recette.

Voir aussi : [Rétroplanning (Ordonnancement)](./document-structure.md#retroplanning-ordonnancement) dans la référence de structure de document.

## Gestion des Erreurs

Le compilateur valide les déclarations de `~minuteur` et les annotations de rétroplanning de section pour garantir une planification précise, et produira des avertissements spécifiques pour des données mal formées :

- **Unité Manquante** (`~minuteur`) : Si vous écrivez `~{30}` sans préciser s'il s'agit de minutes ou d'heures, le compilateur avertit `MISSING_UNIT`.
- **Unité Invalide** (`~minuteur`) : Si vous fournissez une unité que le compilateur ne comprend pas (ex : `~{30 années-lumière}`), il avertit `INVALID_UNIT`.
- **Unité Manquante** (rétroplanning de section) : `~{-2}`, du texte libre comme `~{la veille}`, une valeur non signée ou positive (`~{2h}`), ou une valeur nulle (`~{0h}`, `~{-0h}`) déclenchent tous `MISSING_UNIT` — aucun n'est une durée signée strictement négative.
- **Unité Invalide** (rétroplanning de section) : une unité non reconnue (ex : `~{-2 années-lumière}`) déclenche `INVALID_UNIT`.

Pour le rétroplanning de section, l'annotation d'origine reste affichée telle quelle même en cas d'avertissement. Dans tous les cas, ces avertissements sont non bloquants par défaut (la recette compile toujours), mais sont promus en erreurs bloquantes avec `gram check --strict`.

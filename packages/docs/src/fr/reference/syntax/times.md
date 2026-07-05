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
| **NON** (Une machine/le temps fait le travail) | **Passif** | `~&` | *Cuisson au four, repos, robot pâtissier* |

:::

### Actif (Par défaut)
Par défaut, un `~minuteur` est actif. Cela implique que vous travaillez activement et cela **bloque** le flux de travail. Vous devez terminer cette étape avant de pouvoir faire autre chose.

```gram
Fouetter la @crème liquide{} en continu pendant ~{5 min}.
```
> ⏱️ **Résultat :** Ajoute 5 minutes au **Temps Actif**.

### Passif (`&`)
Utilisez le modificateur `&` pour rendre un `~minuteur` passif. C'est une **tâche en arrière-plan**. Vous démarrez le `~minuteur` (ex : mettre un plat au four) et passez immédiatement à l'étape suivante.

```gram
Cuire dans le #four pendant ~&{45 min}.

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
| **Minuteur Passif** (`~&{1 h}`) | - | - | **+ 1 heure** (en arrière-plan) | **+ 1 heure** |
| **Étape sans aucun minuteur** | - | **+ 2 min** (valeur par défaut) | **+ 2 min** | **+ 2 min** |

### Suivi Intelligent des Dépendances
Vous n'avez pas besoin de faire des mathématiques complexes ! Si vous déclarez une pâte qui repose pendant `~&{1 h}` en arrière-plan, et qu'une étape ultérieure requiert cette `&pâte`, le compilateur va automatiquement "mettre en pause" la ligne du temps et attendre que l'heure se termine avant de commencer cette étape.

## Gestion des Erreurs

Le compilateur valide les déclarations de `~minuteur` pour garantir une planification précise et produira des avertissements spécifiques pour des données mal formées :

- **Unité Manquante** : Si vous écrivez `~{30}` sans préciser s'il s'agit de minutes ou d'heures, le compilateur avertit `MISSING_UNIT`.
- **Unité Invalide** : Si vous fournissez une unité que le compilateur ne comprend pas (ex : `~{30 années-lumière}`), il avertit `INVALID_UNIT`.

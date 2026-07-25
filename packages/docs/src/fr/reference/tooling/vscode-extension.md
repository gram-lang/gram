# Extension VS Code

L'extension officielle Gram pour VS Code transforme votre éditeur en un environnement de développement dédié aux recettes. Propulsée par le `@gram-lang/language-server`, elle offre des diagnostics en temps réel, une assistance avancée à la rédaction et un rendu dynamique en direct.

## Capacités Principales

### 1. Aperçu en Direct Dynamique & Nutrition
- **Rendu Côte-à-Côte** : À mesure que vous tapez, l'extension effectue le rendu de votre fichier `.gram` en HTML dans un panneau WebView dédié. Elle utilise les styles officiels du Playground, garantissant une correspondance parfaite avec les sorties de production.
- **Gestion des Erreurs de Syntaxe** : Si votre recette contient des erreurs de syntaxe qui empêchent la compilation, le panneau d'aperçu affiche le message d'erreur, vous tenant informé sans pour autant planter.

::: info 📊 CodeLens des Macros
Un bouton `CodeLens` dédié apparaît au-dessus du titre de la recette. Cliquer dessus révèle un panneau nutritionnel détaillé (calories, protéines, glucides, lipides) au sein de l'Aperçu en Direct. Il signale également les ingrédients absents de la base de données.
:::

### 2. Vue Diagramme de Gantt
- **Panneau Chronologique** : Lancez `Gram: Gantt Chart` (ou cliquez sur l'icône graphique dans la barre d'outils de l'éditeur) pour ouvrir une vue chronologique dédiée de la recette — étapes actives, minuteurs en tâche de fond, et compression des temps morts — dans son propre panneau WebView, indépendant de l'Aperçu en Direct.
- **Modes Horaires** : Basculez entre le temps écoulé (chronomètre, T+), le compte à rebours (T-), et l'heure réelle basée sur une heure de service cible, via le menu d'options du panneau.
- **Vue Compacte** : Activez une mise en page plus dense pour les recettes comportant de nombreuses étapes qui se chevauchent.

### 3. Gestion Intelligente des Ingrédients
- **Gestion Silencieuse des Pluriels** : L'extension fait correspondre les noms au pluriel simples dans votre recette (ex : `@carottes`) aux entrées singulières de votre base de données YAML (`carotte`), maintenant ainsi le côté naturel du langage sans déclencher de fausses erreurs.
- **Correspondance Approximative** : Si vous faites une faute de frappe sur un ingrédient, un algorithme de distance de Levenshtein suggère la correspondance connue la plus proche via des Actions de Code (Corrections Rapides / Quick Fixes).
- **Informations au Survol** : Survolez n'importe quel ingrédient pour voir sa répartition nutritionnelle complète. Si la base de données spécifie une densité, le survol fournit également des conversions volume-masse en temps réel (ex : `1 c.à.s → 15 g`).

::: tip Chargement Automatique de la Base de Données
L'extension localise automatiquement votre fichier `.gram/ingredients.yaml` à la racine de l'espace de travail. Vous pouvez également configurer explicitement `gram.ingredientDatabase.path` dans vos paramètres VS Code.
:::

### 4. Assistance à l'Édition & Navigation
- **Jetons Sémantiques (Semantic Tokens)** : La coloration par expressions régulières (Regex) est remplacée par une coloration sémantique pilotée par l'AST. Cela garantit que les modificateurs, les unités imbriquées et les ingrédients composites (`<@`) sont colorés de manière précise en fonction de leur rôle.
- **Autocomplétion Intelligente** :
  - `@` suggère les ingrédients de votre base de données, en ajoutant automatiquement `{}` pour les noms composés de plusieurs mots.
  - `&` suggère les déclarations intermédiaires disponibles (ex : `->&pâte`).
  - `{}` suggère de manière contextuelle les unités canoniques (masse, volume, temps) et leurs alias dès qu'un chiffre est tapé.

#### Raccourcis de Navigation

| Raccourci | Commande | Comportement |
|---|---|---|
| `F12` | Aller à la Définition | Saute d'une référence (`&ref`) à sa déclaration (`->&ref`). |
| `Maj+F12` | Trouver Toutes les Références | Localise chaque utilisation d'une variable intermédiaire spécifique. |
| `F2` | Renommer le Symbole | Renomme de manière atomique les variables intermédiaires à travers tout votre document. |

### 5. Diagnostics & Refactorisation
- **Validation en Temps Réel** : Le LSP signale immédiatement les références orphelines, les déclarations inutilisées et les champs de frontmatter manquants.
- **Actions de Code 💡** :
  - Ajouter un `title:` manquant dans le frontmatter.
  - Supprimer les déclarations intermédiaires inutilisées.
  - Déclarer un intermédiaire manquant pour une référence existante.
  - Convertir les quantités en volume directement en masse dans votre code (si la densité est connue).

### 6. Auto-formatage
Déclenchez le formatage du document (`Alt+Maj+F` ou `Maj+Option+F` sur macOS) pour nettoyer instantanément la syntaxe :

```diff
- ##    Pâte   ->&pâte
- Ajouter le @zeste{1} < @citron et le @sel{ 15 g }.
+ ## Pâte ->&pâte
+ Ajouter le @zeste{1}<@citron et le @sel{15g}.
```

## Améliorations de l'Interface de l'Éditeur
- **Indications en Ligne (Inlay Hints)** : Affiche le temps écoulé cumulé (en texte gris) à côté des en-têtes de section, vous aidant à évaluer les durées totales de préparation d'un coup d'œil.
- **Vue Plan (Outline)** : Le panneau natif Outline de VS Code se remplit d'une hiérarchie claire des sections et des intermédiaires de votre recette, rendant la navigation dans les grands documents très facile.
- **Pliage (Gutter Folding)** : Les sections et les blocs frontmatter peuvent être repliés pour gagner de l'espace à l'écran.
- **Extraits de Code Riches (Snippets)** : Tapez des raccourcis comme `recipe`, `##`, `step`, `@ing`, ou `#cw` pour générer rapidement des structures de recettes courantes.

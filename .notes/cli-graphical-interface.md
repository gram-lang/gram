# Gram CLI UX/UI Redesign Plan

Ce document propose une refonte conceptuelle de l'expérience utilisateur (UX) et de l'interface (UI) du CLI `@gram/cli`. L'objectif est de passer d'un outil en ligne de commande utilitaire à une véritable expérience interactive, moderne et agréable (TUI - Terminal User Interface).

## User Review Required

> [!IMPORTANT]
> Ce plan est purement conceptuel. Aucune ligne de code ne sera écrite avant votre validation. Merci d'indiquer quelles fonctionnalités visuelles et quels workflows interactifs vous semblent pertinents à implémenter.

## 1. L'Expérience Globale & Identité Visuelle

Pour donner un aspect "Premium" et moderne au CLI :

- **Le "Splash Screen" (Bannière)** : Lancement d'un gros logo en ASCII Art dégradé avec la version de `@gram/cli` affichée subtilement en dessous. Ne s'affiche que sur la commande racine (quand on tape `gram` sans arguments).
- **Typographie & Couleurs (Design System)** :
  - **Succès** : Vert émeraude (ex: `✓ Recette valide`).
  - **Erreurs** : Rouge corail pour les problèmes de parsing.
  - **Méta-données** : Gris subtil (dim) pour les timestamps ou les chemins de fichiers.
  - **Catégories** : Code couleur par type d'ingrédient (ex: Laitage en bleu, Épices en orange) dans `gram view` et `gram shop`.
- **Librairies recommandées** : `@clack/prompts` (déjà utilisé, à étendre), `ink` (pour du React-in-terminal, idéal pour `view` et le dashboard), ou `chalk`/`ora` pour des spinners élégants.

## 2. Le Mode "Dashboard" Interactif (La nouveauté majeure)

**Actuellement** : Taper `gram` affiche l'aide texte classique.
**Nouvelle approche** : Taper `gram` ouvre un **Menu Interactif (Dashboard)**.

> [!TIP]
> Le Dashboard agit comme un hub central. L'utilisateur utilise les flèches directionnelles pour naviguer.

**Écran d'accueil interactif :**
```text
  ██████╗ ██████╗  █████╗ ███╗   ███╗
 ██╔════╝ ██╔══██╗██╔══██╗████╗ ████║
 ██║  ███╗██████╔╝███████║██╔████╔██║
 ██║   ██║██╔══██╗██╔══██║██║╚██╔╝██║
 ╚██████╔╝██║  ██║██║  ██║██║ ╚═╝ ██║
  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝
           CLI v0.11.0

Que voulez-vous faire aujourd'hui ?
❯ 📖 Parcourir les recettes (View)
  🛒 Faire les courses (Shop)
  🔄 Synchroniser les ingrédients (DB)
  📥 Importer une recette du web (Import)
  🧪 Vérifier le projet (Check)
```

## 3. Refonte par Commande (Le Workflow Utilisateur)

### 🥑 A. La Base de Données (`gram db ...`)
Le workflow de la base de données est le plus complexe. Rendons-le fluide.

- **`gram db sync`** :
  - **Visuel** : Afficher un résumé sous forme de "Diff" (ajout / suppression).
  - **Interactivité** : Au lieu de juste loguer les items "new", proposer une interface de sélection multiple pour décider quels ingrédients rajouter, ignorer, ou mapper manuellement.
- **`gram db enrich`** :
  - **Visuel** : Afficher un *Spinner* moderne avec une phrase tournante (`🧠 Analyse Gemini en cours...`, `📊 Extraction des calories...`).
  - **Résultat** : Une jolie table ASCII montrant le "Avant / Après" de la base de données.
- **`gram db validate`** :
  - **Visuel** : Une vue en arbre (Tree view) similaire à ESLint formatté, groupant les erreurs par ingrédient avec un chemin clair (`ingredient > physical > yield`).

### 📖 B. La Lecture & Cuisiner (`gram view`)
C'est le mode "Usage". L'utilisateur est en cuisine avec son laptop ou terminal.

- **Fuzzy Finder interactif** : Si l'utilisateur tape `gram view` sans argument, ouvrir un *Fuzzy Finder* plein écran (style `fzf`) listant toutes les recettes du projet avec leur temps de préparation en aperçu, permettant de chercher en tapant.
- **Mode "Focus" (Step-by-step)** : Ajouter un flag `gram view --cook`.
  - Au lieu de tout afficher d'un coup, le terminal efface l'écran et affiche **une étape à la fois** en très gros caractères.
  - L'utilisateur appuie sur `Espace` pour passer à l'étape suivante, avec une barre de progression en bas (`[██████░░░░] Étape 2/5`).
  - Idéal pour lire de loin en cuisinant !

### 🛒 C. Les Courses (`gram shop`)
- **Sélection Interactive** : Si lancé sans argument, lister les recettes et demander "Pour quelles recettes faites-vous les courses ?" avec des cases à cocher `[x] Pancakes  [ ] Tarte`.
- **Rendu Terminal** : Une mise en page en 2 colonnes si le terminal est assez large, séparant clairement les "Dairy" des "Grains" avec des icônes/emojis.
- **Mode interactif "Caddie"** : Possibilité de cocher les éléments en direct dans le terminal avec la touche Espace (bien que l'export MD soit plus adapté pour le téléphone).

### 🔍 D. L'Audit (`gram check`)
- **Visuel** : Inspiré de `Vitest` ou `Jest`.
- Une barre de progression en temps réel balayant les fichiers.
- Un affichage groupé des erreurs :
```text
FAIL  recipes/desserts/pancakes.gram
  ✗ Ligne 14: Quantité "une pincée" non reconnue.
  ✗ Ligne 22: L'ingrédient @sucre n'est pas dans la base de données.

✓ recipes/mains/pasta.gram (Valid)

Test Suites: 1 failed, 1 passed, 2 total
```

### 📥 E. L'Import (`gram import`)
- **Interactivité** :
  1. Demander l'URL visuellement.
  2. Spinner "Téléchargement et parsing du JSON-LD..."
  3. Afficher le Markdown de la recette téléchargée avec syntax highlighting direct dans le terminal.
  4. Prompt : "Voulez-vous sauvegarder cette recette ? (Y/n)" -> "Sous quel nom ? (nom suggéré)".

## 4. Fonctionnalités "Modernes" transverses

1. **Watch Mode (`--watch`)** :
   - Pour `gram view` ou `gram check`. Quand on modifie un `.gram` dans l'éditeur (VSCode), le terminal se rafraîchit instantanément avec les nouvelles données ou erreurs.
2. **Auto-suggestions & Did you mean?** :
   - Si une commande ou un chemin de recette est mal typé (ex: `gram viw pencakes.gram`), suggérer `Did you mean "gram view pancakes.gram"?`.
3. **Paging natif** :
   - Amélioration de l'intégration avec `less` ou implémentation d'un pager interne pour les très longues recettes, avec un header sticky (qui reste en haut de l'écran quand on scroll).

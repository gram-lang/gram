---
title: "Extension VS Code"
description: "Aperçu de l'extension VS Code Gram : aperçu en direct, panneau nutritionnel, diagramme de Gantt et correspondance d'ingrédients."
---

L'extension officielle Gram pour VS Code transforme votre éditeur en un véritable IDE dédié aux recettes. Propulsée par le `@gram-lang/language-server`, elle offre des diagnostics en temps réel, une assistance à la saisie avancée et un rendu dynamique en direct.

## Capacités principales

### 1. Aperçu en direct dynamique & nutrition
- **Rendu Côte-à-Côte** : Au fil de votre frappe, l'extension compile à la volée votre `.gram` en HTML dans un panneau WebView dédié. Elle embarque les styles officiels du Playground, garantissant un rendu fidèle au pixel près par rapport à la production.
- **Résilience aux erreurs** : Si votre recette contient des erreurs de syntaxe bloquant la compilation, l'aperçu affiche gracieusement le message d'erreur pour vous tenir informé, sans jamais faire crasher l'extension.

:::note[📊 CodeLens des Macros]
Un bouton `CodeLens` apparaît juste au-dessus du titre de votre recette. Un clic révèle un panneau nutritionnel complet (calories, protéines, glucides, lipides) directement dans l'Aperçu. Il met également en surbrillance les ingrédients introuvables dans votre base de données.
:::

### 2. Vue diagramme de Gantt
- **Panneau Chronologique** : Lancez `Gram: Gantt Chart` (ou cliquez sur l'icône de graphique dans la barre d'outils) pour ouvrir une vue chronologique complète — étapes actives, *timers* passifs, et compression des temps morts. Le tout dans une WebView dédiée, indépendante de l'Aperçu en Direct.
- **Modes Horaires** : Depuis le menu du panneau, basculez à l'envie entre le temps écoulé (chronomètre, T+), le compte à rebours (T-), et un rétroplanning basé sur l'heure de service souhaitée.
- **Vue Compacte** : Pour les recettes complexes grouillant d'étapes simultanées, activez une mise en page densifiée.
- **Mise en place** : la préparation de chaque section est dessinée comme un bloc en pointillés à la couleur de la section, par défaut juste avant elle, tout au début, ou au début de chaque journée de travail (voir le réglage `gram.miseEnPlace` ci-dessous).

#### Le réglage `gram.miseEnPlace` (depuis la 1.4.0)

| Valeur | Effet |
|---|---|
| `perSection` (par défaut) | La mise en place de chaque section est planifiée juste avant cette section. |
| `upfront` | Toute la mise en place est planifiée au début de la recette. |
| `perSession` | La mise en place de chaque journée de travail est planifiée au début de cette journée (les jours viennent des ancres en jours des sections, `~{-Nd}`). |

Le réglage pilote l'aperçu en direct, le diagramme de Gantt et l'indication du temps total à côté du titre de la recette. Il change les temps total et d'attente, pas les listes d'ingrédients, et s'applique tout de suite à toutes les recettes ouvertes, sans recharger la fenêtre. Voir [Quand se fait la mise en place](/fr/docs/reference/syntax/times#quand-se-fait-la-mise-en-place).

#### Le réglage `gram.rests` (depuis la 1.4.0)

| Valeur | Effet |
|---|---|
| `shortest` (par défaut) | Un repos écrit en fourchette (`~_{12-24h}`) dure le plus court de sa fourchette. |
| `balanced` | Il dure le milieu de la fourchette. |
| `longest` | Il dure le plus long de la fourchette. |

Un repos exact et un minuteur actif écrit en fourchette (`~{20-25min}`, toujours planifié sur son chiffre le plus long) ne sont pas touchés. Comme `gram.miseEnPlace`, le réglage pilote l'aperçu, le diagramme de Gantt et l'indication du temps total, et s'applique tout de suite à toutes les recettes ouvertes. Voir [Durées exactes et fourchettes](/fr/docs/reference/syntax/times/#durées-exactes-et-fourchettes).

Une journée de travail qu'un long repos pousse hors de ses 24 heures est signalée sur sa section (`SESSION_OVERFLOW`), comme n'importe quel autre avertissement de la recette.

### 3. Gestion intelligente des ingrédients
- **Gestion silencieuse des pluriels** : L'extension fait intelligemment correspondre les pluriels basiques de votre recette (ex : `@carottes`) aux entrées singulières de votre base YAML (`carotte`). Vous conservez une rédaction naturelle sans déclencher de fausses alertes.
- **Fuzzy Matching** : Une faute de frappe sur un ingrédient ? Un algorithme de Levenshtein vous suggère la correspondance la plus probable via les Actions de Code (*Quick Fixes*).
- **Informations au Survol** : Survolez n'importe quel ingrédient pour inspecter ses macros. Si la base lui associe une densité, le survol convertit instantanément les volumes en masse (ex : `1 c.à.s → 15 g`).

:::tip[Chargement Automatique de la Base de Données]
L'extension détecte automatiquement le fichier `.gram/ingredients.yaml` à la racine de votre *workspace*. Pour des configurations avancées, surchargez `gram.ingredientDatabase.path` dans vos paramètres VS Code.
:::

### 4. Assistance à l'édition & navigation
- **Jetons Sémantiques (*Semantic Tokens*)** : Plutôt qu'une coloration syntaxique basée sur des expressions régulières, l'extension propose une coloration sémantique robuste pilotée par l'AST. Les modificateurs, les unités imbriquées et les ingrédients composites (`<@`) sont colorés avec précision selon leur rôle.
- **Autocomplétion Intelligente** :
  - `@` suggère les ingrédients de la base, en encapsulant automatiquement de `{}` les noms composés.
  - `&` suggère les variables intermédiaires déclarées en amont (ex : `->&pâte`).
  - `{}` suggère contextuellement les unités canoniques (masse, volume, temps) et leurs alias dès que vous tapez un chiffre.

#### Raccourcis de navigation

| Raccourci | Commande | Comportement |
|---|---|---|
| `F12` | Aller à la Définition | Saute d'une référence (`&ref`) vers sa déclaration initiale (`->&ref`). |
| `Maj+F12` | Trouver Toutes les Références | Liste toutes les occurrences d'une variable intermédiaire. |
| `F2` | Renommer le Symbole | Renomme de manière sûre et atomique une variable dans tout le document. |

### 5. Diagnostics & refactorisation
- **Validation en Temps Réel** : Le LSP lève un drapeau instantanément sur les références orphelines, les déclarations inutilisées et les clés de frontmatter manquantes.
- **Actions de Code 💡** :
  - Ajouter une clé `title:` manquante au frontmatter.
  - Nettoyer les déclarations intermédiaires fantômes.
  - Déclarer une variable manquante pour une référence orpheline.
  - Convertir un volume en masse directement dans le code source (si la densité est connue).

### 6. Auto-formatage
Déclenchez le formatage du document (`Alt+Maj+F` ou `Maj+Option+F` sur macOS) pour nettoyer instantanément la syntaxe :

```diff
- ##    Pâte   ->&pâte
- Ajouter le @zeste de citron{1} < @citron et le @sel{ 15 g }.
+ ## Pâte ->&pâte
+ Ajouter le @zeste de citron{1}<@citron et le @sel{15g}.
```

## Améliorations de l'interface de l'éditeur
- **Indications *inline* (*Inlay Hints*)** : affiche le temps total de la recette (en texte grisé) en fin de ligne `title:`, pour évaluer la durée d'ensemble d'un seul coup d'œil. Il suit le réglage `gram.miseEnPlace`.
- **Vue Plan (*Outline*)** : Le panneau natif *Outline* de VS Code s'enrichit de la hiérarchie des sections et des variables intermédiaires : un atout majeur pour naviguer dans de longues recettes.
- **Pliage (*Gutter Folding*)** : Le frontmatter et le contenu des sections peuvent être repliés pour alléger votre écran.
- **Snippets malins** : Tapez des raccourcis comme `recipe`, `##`, `step`, `@ing` ou `#cw` pour *bootstrapper* rapidement des blocs entiers.

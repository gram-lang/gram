# @gram/cli — Hub et Vue d'ensemble des fonctionnalités

> **Document centralisé** de toutes les fonctionnalités et commandes envisagées pour le CLI GRAM. 
> Ce document consolide la vision technique, les idées métiers (issues de `cli.md` et `cli-more.md`), et le plan d'implémentation actuel.

---

## 1. Vue d'ensemble et Catégories

Les commandes sont réparties en **6 grands domaines d'usage** :
1. **Core / Dev** : Pipeline fondamental, validation, build (la machinerie).
2. **Database** : Gestion de la base d'ingrédients (`db.yaml`).
3. **Usage quotidien (Value)** : Analyse, courses, planification (la "killer feature").
4. **Cuisine & Affichage** : Consulter et interagir avec les recettes.
5. **Import & Export** : Interopérabilité et IA.
6. **Lifestyle / Perso** : Gestion des stocks, finances, saisonnalité.

### Grille de Priorisation
- **P0** : Strict minimum vital pour utiliser le CLI.
- **P1** : Première itération de "Valeur Ajoutée" (Pourquoi utiliser GRAM ?).
- **P2** : Amélioration UX et cas d'usage puissants.
- **P3** : Futur, expérimental, "nice-to-have".

---

## 2. Tableau de Synthèse des Commandes

| Commande | Cat. | Description | Priorité | Avantages / Valeur | Défis techniques / Inconvénients |
|---|---|---|---|---|---|
| **`check`** | Core | Valide la syntaxe et les dépendances des `.gram`. | **P0** | Sécurise la saisie, pre-commit hook idéal, évite les erreurs de formatage. | Les erreurs doivent être très claires (stack trace interdite), nécessite le watch mode. |
| **`build`** | Core | Compile un/des `.gram` en JSON structuré. | **P0** | Pont vers 11ty et l'écosystème web. | Performances de parsing sur gros volume. |
| **`init`** | Core | Scaffolding de projet `.gram/` | **P0** | Onboarding facile. | Minimaliste à implémenter. |
| **`config`** | Core | Gestion CLI de la config locale/globale. | **P1** | Évite les erreurs YAML à la main. | Système de fallback local/global à bien concevoir. |
| **`format`** | Core | Auto-formatage type Prettier. | **P2** | Uniformité du code. | Demande d'écrire un "printer" robuste pour l'AST complet. |
| **`watch`** | Core | Surveillance de dossier standalone. | **P1** | Confort de dev. | Chokidar ajoute des dépendances lourdes (bien que Bun.watch existe). |
| --- | --- | --- | --- | --- | --- |
| **`db extract`** | DB | Extrait les @ingrédients vers la db locale. | **P1** | Peuple la base passivement. | Gérer les doublons et les merges sans écraser. |
| **`db validate`** | DB | Valide l'intégrité de `db.yaml`. | **P1** | Évite de casser `analyze` ou `shop` à cause d'une densité manquante. | - |
| **`db enrich`** | DB | Appelle l'IA pour combler les trous (densité, macros). | **P2** | Fait gagner des heures de recherche Google. | Coûts d'API, nécessite validation humaine du JSON produit. |
| **`db merge`** | DB | Fusionne des bases externes. | **P2** | Partage de DB entre amis. | Conflits complexes. |
| **`db search`** | DB | Recherche un ingrédient. | **P2** | Utile mais remplaçable par un `grep`. | - |
| --- | --- | --- | --- | --- | --- |
| **`shop`** | Usage | Liste de courses agrégée (ex: 200g + 100g = 300g). | **P1** | **Killer feature.** Remplace l'app de courses. | Règles de conversion d'unités complexes (Volume -> Masse). |
| **`analyze`** | Usage | Timing, macros et data d'une recette. | **P1** | Focus nutritionnel fort. | - |
| **`plan`** | Usage | Assigner des recettes à des jours. | **P2** | Planification hebdomadaire. | Définir un format de fichier YAML robuste pour le plan. |
| **`scale`** | Usage | Redimensionner les portions d'une recette. | **P2** | Mathématiques automatiques, très pratique. | Faut-il écrire in-place ou créer un nouveau fichier ? |
| --- | --- | --- | --- | --- | --- |
| **`view`** | Cuisine | Affichage terminal coloré et dense. | **P1** | Remplace `cat`, lit une recette direct en CLI. | Calcul des largeurs ANSI / tableaux dans le shell. |
| **`render`** | Cuisine | Export MD ou HTML brut. | **P3** | Portabilité. | Un peu redondant avec 11ty. |
| **`cook`** | Cuisine | Mode interactif TUI (étape par étape avec timers). | **P3** | UX ultime pour cuisiner laptop ouvert. | Tech complexe (Ink, stdout handling, timers asynchrones). |
| --- | --- | --- | --- | --- | --- |
| **`import`** | Import | Depuis JSON-LD (Robuste) ou web scraping (IA). | **P2** | Migration depuis l'existant. | Le web scraping casse souvent. Le JSON-LD est P2 prioritaire. |
| **`ai generate`**| Import | IA : "Crée une recette de tarte" -> `.gram`. | **P2** | Fun et inspirant. | Hallucinations possibles sur les temps ou températures. |
| **`diff`** | Import | Diff sémantique ("+10% de farine"). | **P3** | Analyser l'évolution de ses goûts. | Algorithmique lourde sur l'AST. |
| --- | --- | --- | --- | --- | --- |
| **`pantry`** | Life | Gestion des stocks, soustrait du `shop`. | **P3** | Outil ultime du quotidien. | Beaucoup de maintenance manuelle de l'utilisateur (mise à jour des stocks). |
| **`batch`** | Life | Ordonnance le batch cooking du dimanche. | **P3** | Optimisation dingue du temps. | Parsing des instructions très avancé requis (extraire les actions parallélisables). |
| **`cost`** | Life | Estimation du prix par portion ou pour la semaine. | **P3** | Budget sous contrôle. | Nécessite d'ajouter les prix dans `db.yaml` (fluctue avec le temps). |
| **`suggest`** | Life | "Que faire avec x et y ?" (Anti-gaspi). | **P3** | Dépanne les soirs de flemme. | - |
| **`season`** | Life | Avertissement fruits/légumes hors saison. | **P3** | Écologie. | Données saisonnières complexes selon hémisphère. |

---

## 3. Architecture Validée

L'architecture `commands` → `services` → `ui` est **maintenue comme référence**.
- **Couche Commands** : Routage CLI via `citty`, parsing des arguments.
- **Couche Services** : Pure logique TypeScript, I/O fichiers mais **zéro `console.log`**.
- **Couche UI** : Formatage (`chalk`) et UX interactive (`@clack/prompts`).

## 4. Recommandation du chemin critique (Roadmap)

Pour ne pas se noyer sous ces idées grandioses, voici l'entonnoir d'implémentation conseillé :

1. **La Fondation (Immédiat)** : 
   - `init` (créer le projet)
   - `check` (valider son code)
   - `build` (générer les JSON pour 11ty)
2. **La Boucle de Valeur Quotidienne (Phase 2)** :
   - `db extract` (peupler sa base sans effort)
   - `shop` (faire ses courses avec le CLI, la première grosse récompense)
3. **Le Confort Utilisateur (Phase 3)** :
   - `view` (pour lire facilement sans interface web)
   - `import --jsonld` (pour récupérer des recettes externes)
   - `db enrich` (l'IA pour finaliser les nutrition/densité)
4. **Le Système Domestique ("Endgame")** :
   - `plan`, `pantry`, `cost` (devenir une machine d'organisation).

---
*Ce document sert d'étoile du nord. Toute nouvelle idée doit être confrontée à ce tableau pour évaluer son ROI par rapport à l'architecture existante.*

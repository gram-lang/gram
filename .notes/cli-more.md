Viewed cli-ideation.md:1-783

Ce document d'idéation est excellent, il donne une vision très claire et utilitariste du CLI. L'analogie avec les outils de développement (Prettier pour le formatage, ESLint pour le linting) transposée à la cuisine est très puissante. 

Voici un retour sur les fonctionnalités qui me semblent les plus prometteuses, ainsi que quelques idées nouvelles pour enrichir l'usage personnel de `@gram/cli`.

### 1. Les fonctionnalités proposées les plus impactantes (La "Killer Value")

Parmi tout ce que tu as listé, certaines commandes sortent du lot car elles résolvent de vrais problèmes du quotidien (que les apps de recettes classiques gèrent mal) :

*   **`gram plan` (Planification) & `gram shop` (Liste de courses) :** C'est sans conteste le cœur de la valeur de GRAM. Le fait que GRAM impose des quantités strictes prend tout son sens ici. L'agrégation intelligente des listes de courses avec conversion d'unités (ex: 200g + 300g = 500g) va faire gagner un temps fou.
*   **`gram db enrich` (via IA) :** Maintenir une base d'ingrédients précise (densité, calories, etc.) est généralement la partie la plus rébarbative de ce genre de système. Déléguer cette complétion à Gemini (avec `gemini-1.5-flash` qui est parfait pour ça) transforme une corvée en magie.
*   **`gram import --jsonld` :** Le web est rempli de recettes, mais les scraper est un cauchemar. Se baser sur la spécification `schema.org/Recipe` (JSON-LD) est de loin l'approche la plus fiable. Cela permet d'aspirer une recette de Marmiton ou d'un blog en une fraction de seconde.
*   **`gram diff` (Diff sémantique) :** C'est une idée brillante. En cuisine, on itère souvent ("la dernière fois la pâte était trop sèche, j'ajoute 20ml d'eau"). Avoir un outil qui dit *"Tu as augmenté l'eau de 10% et réduit le temps de cuisson de 5min"* par rapport à la version précédente est un super outil d'apprentissage personnel.
*   **`gram cook / gram view` :** Avoir la recette colorisée et lisible directement dans le terminal, de manière claire et dense.

---

### 2. Nouvelles idées pour un usage personnel et quotidien

Pour aller encore plus loin dans l'approche "outil du quotidien pour soi-même", voici quelques idées de fonctionnalités complémentaires que le CLI pourrait porter.

#### A. Gestion des stocks et du cellier (`gram pantry`)
Si GRAM sait générer une liste de courses, il pourrait aussi déduire ce que tu as déjà.
*   **Idée :** Ajouter une notion de stock dans `db.yaml` ou un `pantry.yaml`.
*   **Commande :** `gram pantry check brioche.gram` → Te dirait : *"Il te manque 100g de beurre et 2 œufs pour faire cette recette"*.
*   **Synergie :** `gram shop --check-pantry` générerait la liste de courses en déduisant automatiquement ce que tu as déjà dans tes placards.

#### B. Mode Cuisine Interactif (`gram cook`)
Plutôt que de juste lire la recette (`gram view`), le CLI pourrait t'accompagner pendant la préparation.
*   **Idée :** Une interface TUI (Text User Interface) qui affiche les étapes une par une. 
*   **Fonctionnement :** Tu appuies sur `Espace` pour passer à l'étape suivante. 
*   **Le petit plus :** Si l'étape mentionne "Laisser reposer 2 heures" ou "Cuire 30 min", le CLI lance **automatiquement un minuteur** dans ton terminal avec une barre de progression ou t'envoie une notification système quand c'est prêt.

#### C. L'optimisation du "Batch Cooking" (`gram batch`)
Si tu cuisines pour la semaine le dimanche, préparer les recettes l'une après l'autre est inefficace.
*   **Idée :** Une commande `gram batch plan.yaml` qui analyse toutes les recettes prévues et tente de **paralléliser ou mutualiser les tâches**.
*   **Exemple :** "Tu as 3 recettes qui nécessitent des oignons émincés. Émince 4 oignons d'un coup maintenant." ou "Pendant que le plat A cuit (45min), commence la préparation du plat B".

#### D. Estimation des coûts (`gram cost`)
En ces temps d'inflation, suivre le coût de ses repas est un super cas d'usage personnel.
*   **Idée :** Ajouter un champ `price: 1.5€ / kg` dans la base `db.yaml`.
*   **Commande :** `gram cost plan.yaml` ou `gram cost brioche.gram`.
*   **Résultat :** Le CLI te donne le prix estimé par portion et le coût total de ta liste de courses de la semaine. Tu pourrais faire `gram cost plan.yaml --optimize` pour qu'il te suggère de remplacer un ingrédient cher par un substitut moins cher.

#### E. Anti-gaspi et "Qu'est-ce qu'on mange ?" (`gram suggest`)
Quand tu ne sais pas quoi faire et que tu as des restes.
*   **Commande :** `gram suggest --with "carottes, oeufs"`
*   **Résultat :** Le CLI croise tes recettes locales qui utilisent ces ingrédients en priorité. S'il n'en trouve pas, il peut faire un appel à Gemini (`gram ai suggest --with...`) pour générer une recette sur le pouce à partir de ces ingrédients.

#### F. Saisonnalité (`gram season`)
Manger de saison est complexe à retenir.
*   **Idée :** Ajouter des tags de mois de récolte (`season: [6, 7, 8, 9]`) dans la base d'ingrédients.
*   **Commande :** `gram plan` pourrait émettre un `warning` si tu prévois une salade de tomates en décembre, ou `gram suggest` pourrait filtrer automatiquement pour ne proposer que des recettes de saison.

---

### Conclusion sur l'architecture

Le plan que tu as décrit (séparation claire entre `@gram/cli` pour la gestion/données et `eleventy-plugin-gram` pour le rendu web) est très sain. 

Si je devais prioriser la Phase 1 et 2 que tu as listée, je te conseillerais de te concentrer très vite sur la trilogie : **`gram check`** (pour sécuriser la saisie), **`gram build/sync`** (pour brancher sur 11ty et voir le résultat) et **`gram shop`** (car c'est là que réside la valeur immédiate qui te fera dire "Waouh, j'ai gagné du temps").

Est-ce que certaines de ces nouvelles idées résonnent avec ton besoin personnel ?
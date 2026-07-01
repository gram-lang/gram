# @gram/cli — Document d'idéation et roadmap
# @gram/cli — Document d'idéation et roadmap

> **Document vivant.** Ce fichier sert de référence pour la réflexion, la priorisation et le suivi de l'implémentation des fonctionnalités du CLI.
> Mis à jour au fil des décisions.

---

## Vision

`@gram/cli` est **la surface d'usage principale de GRAM pour un usage solo**. Il expose l'ensemble du pipeline `parser → kitchen → analyzer → renderer` sous forme de commandes composables, scriptables, et agréables à utiliser au quotidien — depuis la vérification d'une recette jusqu'à la génération de la liste de courses de la semaine.

Le CLI n'est pas un outil de développement. C'est un **outil de cuisine** : on l'utilise pour écrire des recettes, gérer sa base d'ingrédients, préparer ses courses, et valider/importer des recettes. La **présentation** (site web personnel) est gérée par 11ty via un plugin dédié.

### Séparation des responsabilités : CLI vs Plugin 11ty

| Outil | Rôle | Surface d'usage |
|---|---|---|
| `@gram/cli` | Tâches opérationnelles | Terminal, pre-commit hook, quotidien |
| `eleventy-plugin-gram` | Build & présentation | Build 11ty, déploiement |

Ces deux outils sont **complémentaires, pas redondants**. Le plugin 11ty compile les recettes au build et génère les pages. Le CLI sert à valider, importer, gérer la base d'ingrédients, générer des listes de courses — des tâches indépendantes du site.

> **`gram sync` est supprimé du plan.** C'est le plugin 11ty qui prend ce rôle.

---

## Priorités

| Niveau | Signification |
|--------|---------------|
| **P0** | Fondation — sans ça, le CLI ne sert à rien |
| **P1** | Valeur core — raison principale d'utiliser le CLI |
| **P2** | Confort et puissance — à implémenter après P1 |
| **P3** | Expérimental / futur — bonne idée, pas urgent |

**Statut :**
- `[ ]` Pas commencé
- `[~]` En réflexion / conception
- `[→]` Planifié pour la prochaine phase
- `[x]` Implémenté

---

## Configuration

### Stratégie adoptée : deux niveaux

```
~/.config/gram/config.yaml   ← Config globale (clés API, préférences utilisateur)
.gram/config.yaml            ← Config projet (db par défaut, langue, dossiers)
.gram/db.yaml                ← Base d'ingrédients (déjà existante)
```

La config projet **surcharge** la config globale. Les clés API sont **toujours globales** (jamais commitées).

### Structure `.gram/config.yaml`

```yaml
version: 1

# Base d'ingrédients utilisée par défaut pour ce projet
database: .gram/db.yaml

# Langue par défaut des recettes
language: fr

# Dossier de sortie pour l'intégration 11ty
output:
 json: ./_data/recipes/
 markdown: ./content/recipes/

# Options de validation
check:
 warnings_as_errors: false
```

### Structure `~/.config/gram/config.yaml`

```yaml
version: 1

# Intégration AI (Gemini)
ai:
 provider: gemini
 api_key: "${GEMINI_API_KEY}"   # ou valeur directe, non commitée
 model: gemini-1.5-flash        # modèle par défaut (économique)

# Base d'ingrédients globale (fallback si pas de config projet)
database: ~/recipes/.gram/db.yaml
```

> **Note :** La variable d'env `GEMINI_API_KEY` est toujours prioritaire sur la valeur en config.

---

## Catalogue de fonctionnalités

---

### Groupe 1 — Pipeline de base

#### `gram check <file|glob>` — Validation P0 `[ ]`

Valide un ou plusieurs fichiers `.gram`. Retourne un exit code `1` si des erreurs sont détectées (utilisable en pre-commit hook).

```bash
gram check recette.gram
gram check "recipes/**/*.gram"
gram check . --watch          # Re-valide à chaque modification
```

**Niveaux de diagnostic :**
- `error` — Syntaxe invalide, référence inexistante (`@&ingredient` non déclaré), unité inconnue
- `warning` — Ingrédient absent de la base de données, temps non renseigné, pas de quantité de portions
- `info` — Suggestions de style, ingrédient sans alias

**Sortie attendue (style eslint) :**
```
✗ brioche.gram
 line 3:12  error    Référence @&beurre non déclarée en amont
 line 7:1   warning  Ingrédient 'levure' absent de la base de données
 line 12:5  info     Temps total non renseigné

1 error, 1 warning, 1 info
```

**Options :**
- `--format json` — Sortie JSON pour intégration dans d'autres outils
- `--watch` / `-w` — Mode surveillance
- `--quiet` — N'affiche que les erreurs (pas les warnings/info)
- `--no-db` — Désactive les warnings liés à la base d'ingrédients

---

#### `gram build <file>` — Compilation vers JSON P0 `[ ]`

Compile un fichier `.gram` en JSON structuré (sortie du pipeline `parser + kitchen + analyzer`). Utile pour l'intégration 11ty et pour déboguer.

```bash
gram build brioche.gram                     # Affiche le JSON sur stdout
gram build brioche.gram --output brioche.json
gram build "recipes/**/*.gram" --output ./_data/recipes/  # Multi-fichiers
```

**Format de sortie JSON :**
```json
{
 "meta": { "title": "Brioche", "servings": 8, "times": { ... } },
 "shopping_list": [ ... ],
 "sections": [ ... ],
 "nutrition": { "per_serving": { ... }, "total": { ... } },
 "source": "brioche.gram"
}
```

**Options :**
- `--pretty` — JSON indenté (par défaut si --output est un fichier)
- `--no-analyze` — Skip l'analyzer (plus rapide, pas de nutrition)
- `--db <path>` — Spécifie une base d'ingrédients alternative

---

#### `gram render <file>` — Rendu Markdown/HTML P0 `[ ]`

Convertit un `.gram` en Markdown ou HTML en utilisant le package `@gram/renderer` existant.

```bash
gram render brioche.gram                    # Markdown sur stdout
gram render brioche.gram --format html
gram render brioche.gram --output brioche.md
gram render "recipes/**/*.gram" --output ./content/recipes/
```

**Options :**
- `--format md|html` — Format de sortie (défaut : `md`)
- `--output <path>` — Fichier ou dossier de destination
- `--template <path>` — Template Handlebars/Nunjucks custom pour HTML

---

#### `gram view <file>` — Visionneuse terminal P1 `[~]`

Affiche une recette `.gram` directement dans le terminal avec **coloration syntaxique ANSI** et un résumé des informations clés. Comparable à `bat` pour le code source.

```bash
gram view brioche.gram
gram view brioche.gram --full     # Inclut nutrition et timing détaillé
```

**Affichage proposé :**
```
┌─ Brioche au beurre ─────────────────────────── 8 portions ─┐
│  ⏱ Prép: 30min  |  Actif: 45min  |  Repos: 2h  |  Total: 3h30  │
└────────────────────────────────────────────────────────────┘

INGRÉDIENTS                     LISTE DE COURSES
─────────────────────────────   ──────────────────────────
[Dough]                         Farine T45        500g
  @farine{500g}                 Beurre            200g
  @beurre{200g}                 Oeufs             4
  @oeufs{4}                     Lait              120ml
  @lait{120ml}                  ...

INSTRUCTIONS
─────────────────────────────
1. [Mix] Le @farine{500g} avec le @lait{120ml}...
```

**Bibliothèques envisagées :** `chalk` pour les couleurs ANSI, `cli-table3` pour les tableaux, pager `less` pour les longues recettes.

> **Note :** Cette commande est la réponse directe au besoin "ouvrir un .gram dans le terminal avec tout le contexte". Elle remplace `cat` pour les recettes.

---

#### `gram format <file>` — Formatage automatique P2 `[ ]`

Auto-formate les fichiers `.gram` (normalisation des espacements, ordre des sections, cohérence des unités). Analogue à Prettier.

```bash
gram format brioche.gram          # Modifie le fichier en place
gram format brioche.gram --check  # Vérifie sans modifier (pour CI)
gram format "recipes/**/*.gram"
```

---

### Groupe 2 — Base de données d'ingrédients

> **Structure de référence** de `.gram/db.yaml` (déjà établie dans `analyzer/tests/fixtures/`) :
> ```yaml
> ingredients:
>  flour:
>    name: "Farine T45"
>    aliases: ["farine", "wheat flour"]
>    tags: ["farine", "poudre"]
>    physical: { density: 0.59, yield: 1.0 }
>    nutrition: { calories: 364, carbs: 76, protein: 10, fat: 1 }
> ```

---

#### `gram db extract <file|glob>` — Extraction d'ingrédients P1 `[ ]`

Parcourt une ou plusieurs recettes `.gram`, extrait tous les ingrédients référencés, et **les ajoute** à la base de données en **respectant l'existant**.

```bash
gram db extract brioche.gram
gram db extract "recipes/**/*.gram"
gram db extract . --dry-run       # Montre ce qui serait ajouté sans modifier
```

**Comportement :**
- Les ingrédients déjà présents dans `db.yaml` sont **ignorés** (pas d'écrasement)
- Les nouveaux ingrédients sont insérés **par ordre alphabétique** sur leur clé
- Chaque nouvel ingrédient est créé avec une structure minimale (name, aliases vide, physical/nutrition à compléter)
- Un rapport est affiché : "12 ingrédients trouvés, 3 nouveaux, 9 déjà présents"

**Sortie `--dry-run` :**
```
Nouveaux ingrédients à ajouter (3) :
 + levure_seche     "levure sèche" — manque: density, nutrition
 + miel             "miel"         — manque: density, nutrition
 + vanille          "vanille"      — manque: density, nutrition

Ingrédients déjà présents (9) : beurre, farine, lait, oeufs...
```

---

#### `gram db validate` — Validation de la base P1 `[ ]`

Vérifie la cohérence et la complétude de la base d'ingrédients.

```bash
gram db validate
gram db validate --strict     # Erreur si des champs nutrition sont manquants
```

**Vérifications effectuées :**
- Ingrédients sans `density` (blocant pour la conversion volume → masse)
- Ingrédients sans données `nutrition` (warning)
- Aliases en doublon entre ingrédients différents
- Tags non normalisés
- Valeurs aberrantes (calories > 900 kcal/100g, yield > 1.0 sans explication)

---

#### `gram db search <query>` — Recherche P2 `[ ]`

Recherche dans la base d'ingrédients par nom, alias ou tag.

```bash
gram db search "farine"
gram db search --tag "sans-gluten"
gram db search --missing nutrition   # Ingrédients sans données nutritionnelles
```

---

#### `gram db merge <db2.yaml>` — Fusion de bases P2 `[ ]`

Fusionne une base externe dans la base principale, avec résolution intelligente des conflits.

```bash
gram db merge ~/Downloads/open-food-facts-export.yaml
gram db merge autre-base.yaml --strategy=prefer-local   # Garde les valeurs locales en cas de conflit
gram db merge autre-base.yaml --strategy=prefer-remote  # Préfère les valeurs importées
```

---

#### `gram db enrich` — Enrichissement AI (Gemini) P2 `[~]`

Envoie les ingrédients **incomplets** de la base à Gemini pour obtenir les données manquantes (densité, nutrition, aliases) et met à jour `db.yaml`.

```bash
gram db enrich                       # Enrichit tous les ingrédients incomplets
gram db enrich --ingredient levure   # Enrichit un ingrédient spécifique
gram db enrich --dry-run             # Montre les données qui seraient ajoutées
gram db enrich --field nutrition     # Enrichit uniquement les données nutritionnelles
```

**Stratégie pour limiter les tokens :**
- N'envoie que les ingrédients avec des **champs manquants** (density, nutrition)
- Traitement **par batch** (ex: 20 ingrédients par appel)
- Cache les résultats : une fois enrichi, l'ingrédient n'est plus envoyé
- Mode `--dry-run` pour estimer le coût avant d'envoyer

**Prompt Gemini (schéma de sortie structuré) :**
```json
{
 "ingredients": [
   {
     "key": "levure_seche",
     "density": 0.85,
     "yield": 1.0,
     "nutrition": { "calories": 325, "carbs": 41, "protein": 40, "fat": 7 },
     "aliases_suggestions": ["dry yeast", "instant yeast"],
     "tags_suggestions": ["levure", "poudre"]
   }
 ]
}
```

> **Modèle recommandé :** `gemini-1.5-flash` (rapide, économique, très capable sur les tâches structurées). `gemini-1.5-pro` pour des cas ambigus si flash échoue.

---

### Groupe 3 — Analyse et génération

#### `gram analyze <file>` — Analyse complète P1 `[ ]`

Affiche une analyse détaillée d'une recette : nutrition, timing, liste de courses, coût estimé.

```bash
gram analyze brioche.gram
gram analyze brioche.gram --format json
gram analyze brioche.gram --per-serving
```

**Sortie affichée :**
```
Brioche au beurre — 8 portions
────────────────────────────────────────────
NUTRITION (par portion)
 Calories   : 342 kcal
 Glucides   : 48g  (dont sucres: 8g)
 Protéines  : 9g
 Lipides    : 12g

TIMING
 Actif      : 45 min
 Préparation: 30 min
 Repos      : 2h 00
 Total      : 3h 15

LISTE DE COURSES
 Farine T45    500g
 Beurre doux   200g
 Oeufs         4 (≈ 200g net)
 Lait entier   120ml
────────────────────────────────────────────
⚠ 2 ingrédients sans données nutritionnelles (levure, vanille)
 → Lancez `gram db enrich` pour les compléter
```

---

#### `gram shop <file> [<file>...]` — Liste de courses P1 `[ ]`

Génère une liste de courses agrégée pour une ou plusieurs recettes, avec consolidation des quantités pour un même ingrédient.

```bash
gram shop brioche.gram
gram shop lundi.gram mercredi.gram vendredi.gram
gram shop "this-week/**/*.gram"
gram shop . --format markdown
gram shop . --format json
```

**Comportement de consolidation :**
- `@farine{200g}` + `@farine{300g}` dans deux recettes → `Farine T45: 500g`
- Conversion d'unités automatique (unifications via `@gram/analyzer`)
- Groupement par catégorie/tag si la db est enrichie avec des tags

**Format de sortie Markdown :**
```markdown
## Liste de courses — Semaine du 16 juin

### Produits laitiers
- [ ] Beurre doux — 350g
- [ ] Lait entier — 500ml
- [ ] Oeufs — 6

### Farines & poudres
- [ ] Farine T45 — 700g
- [ ] Sucre blanc — 150g
```

---

#### `gram scale <file> --servings <n>` — Redimensionnement P2 `[ ]`

Rescale une recette vers un nombre de portions cible et affiche ou sauvegarde le résultat.

```bash
gram scale brioche.gram --servings 12
gram scale brioche.gram --servings 12 --output brioche-12.gram
gram scale brioche.gram --factor 1.5   # Multiplier par 1.5
```

> **Question ouverte :** Faut-il modifier le fichier source ou créer un nouveau fichier ? La sauvegarde dans un nouveau fichier semble plus sûre par défaut.

---

#### `gram plan` — Planification hebdomadaire P2 `[~]`

**La killer feature de GRAM.** Associe des recettes à des jours de la semaine et génère une liste de courses consolidée pour toute la semaine.

```bash
gram plan --mon brioche.gram --mer quiche.gram --ven pasta.gram
gram plan --from plan.yaml        # Fichier de plan de la semaine
gram plan --from plan.yaml --shop # Génère directement la liste de courses
```

**Format `plan.yaml` :**
```yaml
week: 2026-06-16
meals:
 lundi:
   dinner: brioche.gram
 mercredi:
   lunch: salade-nicoise.gram
   dinner: quiche.gram
 vendredi:
   dinner: pasta-carbonara.gram
```

**Sortie :**
- Résumé de la semaine (recettes, nutrition totale estimée)
- Liste de courses consolidée (toutes recettes agrégées)

> **Note :** C'est exactement ce que le modèle de données GRAM permet et que Cooklang ne peut pas faire proprement (pas de notion de quantité stricte).

---

### Groupe 4 — Import et conversion

#### `gram import --url <url>` — Import depuis une page web P2 `[~]`

Récupère le HTML d'une page web, l'analyse avec Gemini, et génère un fichier `.gram`.

```bash
gram import --url "https://example.com/recette-brioche"
gram import --url "https://example.com/recette-brioche" --output brioche.gram
```

**Pipeline d'import :**
1. Fetch HTML de la page (avec `--user-agent` poli)
2. Extraction du contenu principal (strip nav/pub/footer)
3. Détection JSON-LD `schema.org/Recipe` → si trouvé, chemin fiable (voir ci-dessous)
4. Sinon : envoi du texte extrait à Gemini avec prompt de structuration
5. Gemini retourne un JSON structuré → conversion en `.gram`
6. Affichage du résultat + proposition de sauvegarde

**Marqué `--experimental`** : les sites changent, certains bloquent les scrapers. Résultats variables.

---

#### `gram import --jsonld <file|url>` — Import JSON-LD P2 `[ ]`

Convertit un fichier ou une URL JSON-LD (`schema.org/Recipe`) en `.gram`. **Plus fiable que le scraping** — beaucoup de sites exposent leurs recettes en JSON-LD pour le SEO.

```bash
gram import --jsonld recipe.json
gram import --jsonld "https://example.com/recette" --extract-jsonld
```

> **Astuce :** On peut extraire le JSON-LD d'une page HTML en cherchant `<script type="application/ld+json">`. C'est la méthode la plus robuste pour l'import web.

---

#### `gram import --cooklang <file>` — Import depuis Cooklang P3 `[ ]`

Convertit un fichier `.cook` (Cooklang) en `.gram`. Conversion best-effort (Cooklang n'a pas de quantités strictes).

```bash
gram import --cooklang brioche.cook
```

---

#### `gram export --format <format> <file>` — Export P3 `[ ]`

Export vers d'autres formats. PDF délibérément déprioritisé.

```bash
gram export --format markdown brioche.gram
gram export --format html brioche.gram
# PDF : non prioritaire, à reconsidérer si demande réelle
```

---

### Groupe 5 — Intégration 11ty

> **Contexte :** L'objectif est d'utiliser `@gram/cli` comme couche de données pour un site 11ty personnel — accessible depuis n'importe où (courses, cuisine). Le CLI génère les données structurées que 11ty consomme.

---

#### `gram sync` — Synchronisation vers 11ty P1 `[~]`

Compile toutes les recettes d'un dossier et écrit les JSON dans le dossier `_data/` de 11ty.

```bash
gram sync                                   # Utilise la config du projet
gram sync --recipes ./recipes/ --output ./_data/recipes/
gram sync --watch                           # Surveillance + re-sync automatique
```

**Fichiers générés :**
```
_data/
 recipes/
   brioche.json          ← JSON compilé d'une recette
   pasta-carbonara.json
   index.json            ← Index de toutes les recettes (titre, tags, timing...)
```

**Format `index.json` (pour les listings 11ty) :**
```json
[
 {
   "slug": "brioche",
   "title": "Brioche au beurre",
   "servings": 8,
   "tags": ["boulangerie", "sucré"],
   "times": { "total": "3h15", "active": "45min" },
   "source": "brioche.gram"
 }
]
```

**Workflow type avec 11ty :**
```bash
# Terminal 1 : surveille les recettes et régénère les JSON
gram sync --watch

# Terminal 2 : 11ty surveille les JSON et reconstruit le site
npx @11ty/eleventy --serve
```

> **Ou en une commande** avec `concurrently` dans `package.json` :
> ```json
> "dev": "concurrently \"gram sync --watch\" \"eleventy --serve\""
> ```

---

#### Templates 11ty suggérés P3 `[~]`

Exemples de templates Nunjucks pour consommer les données GRAM dans 11ty :

**Page recette (`recipe.njk`) :**
```njk
{% for ingredient in recipe.shopping_list %}
 <li>{{ ingredient.name }} — {{ ingredient.quantity }}{{ ingredient.unit }}</li>
{% endfor %}
```

**Vue "courses" (mobile-first) :**
Liste de courses interactive avec cases à cocher, optimisée pour smartphone.

> **Note :** Ce n'est pas dans le scope du CLI lui-même, mais documenter des templates de départ serait très utile.

---

### Groupe 6 — Intelligence artificielle (Gemini)

> **Provider :** Google Gemini via `@google/generative-ai`. Clé API dans `~/.config/gram/config.yaml` ou variable `GEMINI_API_KEY`.

---

#### `gram ai generate "<prompt>"` — Génération de recette P2 `[~]`

Génère une recette `.gram` complète depuis une description en langage naturel.

```bash
gram ai generate "une tarte aux pommes pour 6 personnes, style alsacien"
gram ai generate "pasta carbonara traditionnelle" --output carbonara.gram
gram ai generate "..." --model gemini-1.5-pro  # Modèle plus puissant si besoin
```

**Considérations :**
- Le prompt système doit inclure la **spécification complète de la syntaxe GRAM**
- Gemini génère du `.gram` valide → passage automatique par `gram check`
- Si `check` échoue → retry automatique avec le message d'erreur (max 2 retries)
- Coût estimé : ~2000-5000 tokens par recette (modèle flash)

---

#### `gram ai translate <file> --lang <code>` — Traduction P3 `[ ]`

Traduit une recette `.gram` dans une autre langue (noms d'ingrédients, instructions) en s'appuyant sur le package `@gram/i18n`.

```bash
gram ai translate brioche.gram --lang en
gram ai translate brioche.gram --lang es --output brioche-es.gram
```

---

#### `gram ai suggest <file>` — Suggestions P3 `[ ]`

Analyse une recette et suggère des améliorations : techniques manquantes, ingrédients optionnels, variantes.

```bash
gram ai suggest brioche.gram
```

---

### Groupe 7 — Outils développeur

#### `gram init` — Initialisation de projet P0 `[ ]`

Crée la structure `.gram/` pour un nouveau projet recettes.

```bash
gram init                  # Dans le dossier courant
gram init --path ~/recipes
```

**Structure créée :**
```
.gram/
 config.yaml   ← Config projet (template pré-rempli)
 db.yaml       ← Base d'ingrédients vide (avec quelques exemples)
 .gitignore    ← Exclut les données sensibles si besoin
```

---

#### `gram watch <dir>` — Surveillance P1 `[ ]`

Surveille un dossier et relance `gram check` (et optionnellement `gram sync`) à chaque modification.

```bash
gram watch .
gram watch recipes/ --check --sync    # Validation + sync 11ty en continu
```

---

#### `gram diff <v1.gram> <v2.gram>` — Diff sémantique P3 `[~]`

Compare deux versions d'une recette au niveau **sémantique** (pas juste textuel).

```bash
gram diff brioche-v1.gram brioche-v2.gram
```

**Sortie :**
```
Différences sémantiques entre brioche-v1.gram et brioche-v2.gram :

INGRÉDIENTS
 ~ farine   200g → 250g  (+25%)
 + levure   5g           (ajouté)
 - sel      2g           (supprimé)

TIMING
 ~ repos    1h → 2h      (+60min)

ÉTAPES
 ~ Étape 3 : instructions modifiées
```

> **Pourquoi c'est unique :** Un diff Git dit "ligne 3 a changé". Ce diff dit "la quantité de farine a augmenté de 25% et une étape de repos a été allongée". Seul un langage data-first comme GRAM peut faire ça.

---

#### `gram config` — Gestion de la configuration P1 `[ ]`

Lit et écrit la configuration sans éditer les fichiers manuellement.

```bash
gram config get ai.provider
gram config set ai.provider gemini
gram config set ai.model gemini-1.5-flash
gram config --global set ai.api_key "ma-cle"  # Config globale
gram config --list                             # Affiche toute la config active
```

---

## Roadmap d'implémentation

### Phase 1 — Fondations (faire fonctionner le pipeline)
- [ ] `gram init` — Créer la structure `.gram/`
- [ ] `gram check` — Validation avec exit codes et messages formatés
- [ ] `gram build` — Compilation vers JSON
- [ ] `gram view` — Visionneuse terminal (coloration ANSI)
- [ ] `gram config` — Lecture/écriture de la config

### Phase 2 — Valeur quotidienne
- [ ] `gram db extract` — Extraction d'ingrédients depuis les recettes
- [ ] `gram db validate` — Validation de la base
- [ ] `gram analyze` — Analyse complète d'une recette
- [ ] `gram shop` — Liste de courses (une ou plusieurs recettes)
- [ ] `gram sync` — Synchronisation vers 11ty + mode `--watch`

### Phase 3 — Puissance et confort
- [ ] `gram render` — Export Markdown/HTML
- [ ] `gram scale` — Redimensionnement de recette
- [ ] `gram plan` — Planification hebdomadaire
- [ ] `gram db search` — Recherche dans la base
- [ ] `gram watch` — Mode surveillance standalone
- [ ] `gram format` — Auto-formatage

### Phase 4 — Import et AI
- [ ] `gram db enrich` — Enrichissement AI via Gemini
- [ ] `gram import --jsonld` — Import JSON-LD (robuste)
- [ ] `gram import --url` — Import web (expérimental, via Gemini)
- [ ] `gram ai generate` — Génération de recette
- [ ] `gram db merge` — Fusion de bases

### Phase 5 — Fonctionnalités avancées (futur)
- [ ] `gram diff` — Diff sémantique
- [ ] `gram ai translate` — Traduction
- [ ] `gram ai suggest` — Suggestions
- [ ] `gram import --cooklang` — Import Cooklang
- [ ] Templates 11ty de départ

---

## Questions ouvertes

| # | Question | Décision |
|---|----------|----------|
| 1 | Framework CLI : `commander.js` vs `yargs` vs `citty` ? | À décider — `citty` est moderne et léger |
| 2 | Affichage terminal : `chalk` + `cli-table3` ou framework TUI complet (`ink`) ? | `chalk` + modules simples pour commencer |
| 3 | `gram view` : utiliser un pager (`less`) pour les longues recettes ? | Oui, avec détection automatique de la taille du terminal |
| 4 | `gram scale` : modifier le fichier source ou créer un nouveau fichier ? | Nouveau fichier par défaut (sécurité), `--in-place` pour modifier |
| 5 | Gestion des erreurs AI : que faire si Gemini est indisponible ? | Fallback gracieux avec message clair, jamais de crash silencieux |
| 6 | `gram sync` : doit-il supprimer les JSON orphelins ? | Oui, avec `--clean` flag et confirmation |

---

## Notes techniques

- **Package manager :** Bun (cohérent avec le reste du monorepo)
- **Language :** TypeScript ESM (cohérent avec les autres packages)
- **Build :** tsup (cohérent)
- **Tests :** Bun test
- **Dépendances attendues :**
 - `citty` ou `commander` — parsing des commandes
 - `chalk` — couleurs ANSI
 - `yaml` — lecture/écriture YAML (déjà dans `analyzer`)
 - `@google/generative-ai` — SDK Gemini (feature-gated)
 - `chokidar` — surveillance de fichiers pour `--watch`
 - `cli-table3` — tableaux dans le terminal

> **Document vivant.** Ce fichier sert de référence pour la réflexion, la priorisation et le suivi de l'implémentation des fonctionnalités du CLI.
> Mis à jour au fil des décisions.

---

## Vision

`@gram/cli` est **la surface d'usage principale de GRAM pour un usage solo**. Il expose l'ensemble du pipeline `parser → kitchen → analyzer → renderer` sous forme de commandes composables, scriptables, et agréables à utiliser au quotidien — depuis la vérification d'une recette jusqu'à la génération de la liste de courses de la semaine.

Le CLI n'est pas un outil de développement. C'est un **outil de cuisine** : on l'utilise pour écrire des recettes, gérer sa base d'ingrédients, préparer ses courses, et valider/importer des recettes. La **présentation** (site web personnel) est gérée par 11ty via un plugin dédié.

### Séparation des responsabilités : CLI vs Plugin 11ty

| Outil | Rôle | Surface d'usage |
|---|---|---|
| `@gram/cli` | Tâches opérationnelles | Terminal, pre-commit hook, quotidien |
| `eleventy-plugin-gram` | Build & présentation | Build 11ty, déploiement |

Ces deux outils sont **complémentaires, pas redondants**. Le plugin 11ty compile les recettes au build et génère les pages. Le CLI sert à valider, importer, gérer la base d'ingrédients, générer des listes de courses — des tâches indépendantes du site.

> **`gram sync` est supprimé du plan.** C'est le plugin 11ty qui prend ce rôle.

---

## Priorités

| Niveau | Signification |
|--------|---------------|
| **P0** | Fondation — sans ça, le CLI ne sert à rien |
| **P1** | Valeur core — raison principale d'utiliser le CLI |
| **P2** | Confort et puissance — à implémenter après P1 |
| **P3** | Expérimental / futur — bonne idée, pas urgent |

**Statut :**
- `[ ]` Pas commencé
- `[~]` En réflexion / conception
- `[→]` Planifié pour la prochaine phase
- `[x]` Implémenté

---

## Configuration

### Stratégie adoptée : deux niveaux

```
~/.config/gram/config.yaml   ← Config globale (clés API, préférences utilisateur)
.gram/config.yaml            ← Config projet (db par défaut, langue, dossiers)
.gram/db.yaml                ← Base d'ingrédients (déjà existante)
```

La config projet **surcharge** la config globale. Les clés API sont **toujours globales** (jamais commitées).

### Structure `.gram/config.yaml`

```yaml
version: 1

# Base d'ingrédients utilisée par défaut pour ce projet
database: .gram/db.yaml

# Langue par défaut des recettes
language: fr

# Dossier de sortie pour l'intégration 11ty
output:
 json: ./_data/recipes/
 markdown: ./content/recipes/

# Options de validation
check:
 warnings_as_errors: false
```

### Structure `~/.config/gram/config.yaml`

```yaml
version: 1

# Intégration AI (Gemini)
ai:
 provider: gemini
 api_key: "${GEMINI_API_KEY}"   # ou valeur directe, non commitée
 model: gemini-1.5-flash        # modèle par défaut (économique)

# Base d'ingrédients globale (fallback si pas de config projet)
database: ~/recipes/.gram/db.yaml
```

> **Note :** La variable d'env `GEMINI_API_KEY` est toujours prioritaire sur la valeur en config.

---

## Catalogue de fonctionnalités

---

### Groupe 1 — Pipeline de base

#### `gram check <file|glob>` — Validation P0 `[ ]`

Valide un ou plusieurs fichiers `.gram`. Retourne un exit code `1` si des erreurs sont détectées (utilisable en pre-commit hook).

```bash
gram check recette.gram
gram check "recipes/**/*.gram"
gram check . --watch          # Re-valide à chaque modification
```

**Niveaux de diagnostic :**
- `error` — Syntaxe invalide, référence inexistante (`@&ingredient` non déclaré), unité inconnue
- `warning` — Ingrédient absent de la base de données, temps non renseigné, pas de quantité de portions
- `info` — Suggestions de style, ingrédient sans alias

**Sortie attendue (style eslint) :**
```
✗ brioche.gram
 line 3:12  error    Référence @&beurre non déclarée en amont
 line 7:1   warning  Ingrédient 'levure' absent de la base de données
 line 12:5  info     Temps total non renseigné

1 error, 1 warning, 1 info
```

**Options :**
- `--format json` — Sortie JSON pour intégration dans d'autres outils
- `--watch` / `-w` — Mode surveillance
- `--quiet` — N'affiche que les erreurs (pas les warnings/info)
- `--no-db` — Désactive les warnings liés à la base d'ingrédients

---

#### `gram build <file>` — Compilation vers JSON P0 `[ ]`

Compile un fichier `.gram` en JSON structuré (sortie du pipeline `parser + kitchen + analyzer`). Utile pour l'intégration 11ty et pour déboguer.

```bash
gram build brioche.gram                     # Affiche le JSON sur stdout
gram build brioche.gram --output brioche.json
gram build "recipes/**/*.gram" --output ./_data/recipes/  # Multi-fichiers
```

**Format de sortie JSON :**
```json
{
 "meta": { "title": "Brioche", "servings": 8, "times": { ... } },
 "shopping_list": [ ... ],
 "sections": [ ... ],
 "nutrition": { "per_serving": { ... }, "total": { ... } },
 "source": "brioche.gram"
}
```

**Options :**
- `--pretty` — JSON indenté (par défaut si --output est un fichier)
- `--no-analyze` — Skip l'analyzer (plus rapide, pas de nutrition)
- `--db <path>` — Spécifie une base d'ingrédients alternative

---

#### `gram render <file>` — Rendu Markdown/HTML P0 `[ ]`

Convertit un `.gram` en Markdown ou HTML en utilisant le package `@gram/renderer` existant.

```bash
gram render brioche.gram                    # Markdown sur stdout
gram render brioche.gram --format html
gram render brioche.gram --output brioche.md
gram render "recipes/**/*.gram" --output ./content/recipes/
```

**Options :**
- `--format md|html` — Format de sortie (défaut : `md`)
- `--output <path>` — Fichier ou dossier de destination
- `--template <path>` — Template Handlebars/Nunjucks custom pour HTML

---

#### `gram view <file>` — Visionneuse terminal P1 `[~]`

Affiche une recette `.gram` directement dans le terminal avec **coloration syntaxique ANSI** et un résumé des informations clés. Comparable à `bat` pour le code source.

```bash
gram view brioche.gram
gram view brioche.gram --full     # Inclut nutrition et timing détaillé
```

**Affichage proposé :**
```
┌─ Brioche au beurre ─────────────────────────── 8 portions ─┐
│  ⏱ Prép: 30min  |  Actif: 45min  |  Repos: 2h  |  Total: 3h30  │
└────────────────────────────────────────────────────────────┘

INGRÉDIENTS                     LISTE DE COURSES
─────────────────────────────   ──────────────────────────
[Dough]                         Farine T45        500g
  @farine{500g}                 Beurre            200g
  @beurre{200g}                 Oeufs             4
  @oeufs{4}                     Lait              120ml
  @lait{120ml}                  ...

INSTRUCTIONS
─────────────────────────────
1. [Mix] Le @farine{500g} avec le @lait{120ml}...
```

**Bibliothèques envisagées :** `chalk` pour les couleurs ANSI, `cli-table3` pour les tableaux, pager `less` pour les longues recettes.

> **Note :** Cette commande est la réponse directe au besoin "ouvrir un .gram dans le terminal avec tout le contexte". Elle remplace `cat` pour les recettes.

---

#### `gram format <file>` — Formatage automatique P2 `[ ]`

Auto-formate les fichiers `.gram` (normalisation des espacements, ordre des sections, cohérence des unités). Analogue à Prettier.

```bash
gram format brioche.gram          # Modifie le fichier en place
gram format brioche.gram --check  # Vérifie sans modifier (pour CI)
gram format "recipes/**/*.gram"
```

---

### Groupe 2 — Base de données d'ingrédients

> **Structure de référence** de `.gram/db.yaml` (déjà établie dans `analyzer/tests/fixtures/`) :
> ```yaml
> ingredients:
>  flour:
>    name: "Farine T45"
>    aliases: ["farine", "wheat flour"]
>    tags: ["farine", "poudre"]
>    physical: { density: 0.59, yield: 1.0 }
>    nutrition: { calories: 364, carbs: 76, protein: 10, fat: 1 }
> ```

---

#### `gram db extract <file|glob>` — Extraction d'ingrédients P1 `[ ]`

Parcourt une ou plusieurs recettes `.gram`, extrait tous les ingrédients référencés, et **les ajoute** à la base de données en **respectant l'existant**.

```bash
gram db extract brioche.gram
gram db extract "recipes/**/*.gram"
gram db extract . --dry-run       # Montre ce qui serait ajouté sans modifier
```

**Comportement :**
- Les ingrédients déjà présents dans `db.yaml` sont **ignorés** (pas d'écrasement)
- Les nouveaux ingrédients sont insérés **par ordre alphabétique** sur leur clé
- Chaque nouvel ingrédient est créé avec une structure minimale (name, aliases vide, physical/nutrition à compléter)
- Un rapport est affiché : "12 ingrédients trouvés, 3 nouveaux, 9 déjà présents"

**Sortie `--dry-run` :**
```
Nouveaux ingrédients à ajouter (3) :
 + levure_seche     "levure sèche" — manque: density, nutrition
 + miel             "miel"         — manque: density, nutrition
 + vanille          "vanille"      — manque: density, nutrition

Ingrédients déjà présents (9) : beurre, farine, lait, oeufs...
```

---

#### `gram db validate` — Validation de la base P1 `[ ]`

Vérifie la cohérence et la complétude de la base d'ingrédients.

```bash
gram db validate
gram db validate --strict     # Erreur si des champs nutrition sont manquants
```

**Vérifications effectuées :**
- Ingrédients sans `density` (blocant pour la conversion volume → masse)
- Ingrédients sans données `nutrition` (warning)
- Aliases en doublon entre ingrédients différents
- Tags non normalisés
- Valeurs aberrantes (calories > 900 kcal/100g, yield > 1.0 sans explication)

---

#### `gram db search <query>` — Recherche P2 `[ ]`

Recherche dans la base d'ingrédients par nom, alias ou tag.

```bash
gram db search "farine"
gram db search --tag "sans-gluten"
gram db search --missing nutrition   # Ingrédients sans données nutritionnelles
```

---

#### `gram db merge <db2.yaml>` — Fusion de bases P2 `[ ]`

Fusionne une base externe dans la base principale, avec résolution intelligente des conflits.

```bash
gram db merge ~/Downloads/open-food-facts-export.yaml
gram db merge autre-base.yaml --strategy=prefer-local   # Garde les valeurs locales en cas de conflit
gram db merge autre-base.yaml --strategy=prefer-remote  # Préfère les valeurs importées
```

---

#### `gram db enrich` — Enrichissement AI (Gemini) P2 `[~]`

Envoie les ingrédients **incomplets** de la base à Gemini pour obtenir les données manquantes (densité, nutrition, aliases) et met à jour `db.yaml`.

```bash
gram db enrich                       # Enrichit tous les ingrédients incomplets
gram db enrich --ingredient levure   # Enrichit un ingrédient spécifique
gram db enrich --dry-run             # Montre les données qui seraient ajoutées
gram db enrich --field nutrition     # Enrichit uniquement les données nutritionnelles
```

**Stratégie pour limiter les tokens :**
- N'envoie que les ingrédients avec des **champs manquants** (density, nutrition)
- Traitement **par batch** (ex: 20 ingrédients par appel)
- Cache les résultats : une fois enrichi, l'ingrédient n'est plus envoyé
- Mode `--dry-run` pour estimer le coût avant d'envoyer

**Prompt Gemini (schéma de sortie structuré) :**
```json
{
 "ingredients": [
   {
     "key": "levure_seche",
     "density": 0.85,
     "yield": 1.0,
     "nutrition": { "calories": 325, "carbs": 41, "protein": 40, "fat": 7 },
     "aliases_suggestions": ["dry yeast", "instant yeast"],
     "tags_suggestions": ["levure", "poudre"]
   }
 ]
}
```

> **Modèle recommandé :** `gemini-1.5-flash` (rapide, économique, très capable sur les tâches structurées). `gemini-1.5-pro` pour des cas ambigus si flash échoue.

---

### Groupe 3 — Analyse et génération

#### `gram analyze <file>` — Analyse complète P1 `[ ]`

Affiche une analyse détaillée d'une recette : nutrition, timing, liste de courses, coût estimé.

```bash
gram analyze brioche.gram
gram analyze brioche.gram --format json
gram analyze brioche.gram --per-serving
```

**Sortie affichée :**
```
Brioche au beurre — 8 portions
────────────────────────────────────────────
NUTRITION (par portion)
 Calories   : 342 kcal
 Glucides   : 48g  (dont sucres: 8g)
 Protéines  : 9g
 Lipides    : 12g

TIMING
 Actif      : 45 min
 Préparation: 30 min
 Repos      : 2h 00
 Total      : 3h 15

LISTE DE COURSES
 Farine T45    500g
 Beurre doux   200g
 Oeufs         4 (≈ 200g net)
 Lait entier   120ml
────────────────────────────────────────────
⚠ 2 ingrédients sans données nutritionnelles (levure, vanille)
 → Lancez `gram db enrich` pour les compléter
```

---

#### `gram shop <file> [<file>...]` — Liste de courses P1 `[ ]`

Génère une liste de courses agrégée pour une ou plusieurs recettes, avec consolidation des quantités pour un même ingrédient.

```bash
gram shop brioche.gram
gram shop lundi.gram mercredi.gram vendredi.gram
gram shop "this-week/**/*.gram"
gram shop . --format markdown
gram shop . --format json
```

**Comportement de consolidation :**
- `@farine{200g}` + `@farine{300g}` dans deux recettes → `Farine T45: 500g`
- Conversion d'unités automatique (unifications via `@gram/analyzer`)
- Groupement par catégorie/tag si la db est enrichie avec des tags

**Format de sortie Markdown :**
```markdown
## Liste de courses — Semaine du 16 juin

### Produits laitiers
- [ ] Beurre doux — 350g
- [ ] Lait entier — 500ml
- [ ] Oeufs — 6

### Farines & poudres
- [ ] Farine T45 — 700g
- [ ] Sucre blanc — 150g
```

---

#### `gram scale <file> --servings <n>` — Redimensionnement P2 `[ ]`

Rescale une recette vers un nombre de portions cible et affiche ou sauvegarde le résultat.

```bash
gram scale brioche.gram --servings 12
gram scale brioche.gram --servings 12 --output brioche-12.gram
gram scale brioche.gram --factor 1.5   # Multiplier par 1.5
```

> **Question ouverte :** Faut-il modifier le fichier source ou créer un nouveau fichier ? La sauvegarde dans un nouveau fichier semble plus sûre par défaut.

---

#### `gram plan` — Planification hebdomadaire P2 `[~]`

**La killer feature de GRAM.** Associe des recettes à des jours de la semaine et génère une liste de courses consolidée pour toute la semaine.

```bash
gram plan --mon brioche.gram --mer quiche.gram --ven pasta.gram
gram plan --from plan.yaml        # Fichier de plan de la semaine
gram plan --from plan.yaml --shop # Génère directement la liste de courses
```

**Format `plan.yaml` :**
```yaml
week: 2026-06-16
meals:
 lundi:
   dinner: brioche.gram
 mercredi:
   lunch: salade-nicoise.gram
   dinner: quiche.gram
 vendredi:
   dinner: pasta-carbonara.gram
```

**Sortie :**
- Résumé de la semaine (recettes, nutrition totale estimée)
- Liste de courses consolidée (toutes recettes agrégées)

> **Note :** C'est exactement ce que le modèle de données GRAM permet et que Cooklang ne peut pas faire proprement (pas de notion de quantité stricte).

---

### Groupe 4 — Import et conversion

#### `gram import --url <url>` — Import depuis une page web P2 `[~]`

Récupère le HTML d'une page web, l'analyse avec Gemini, et génère un fichier `.gram`.

```bash
gram import --url "https://example.com/recette-brioche"
gram import --url "https://example.com/recette-brioche" --output brioche.gram
```

**Pipeline d'import :**
1. Fetch HTML de la page (avec `--user-agent` poli)
2. Extraction du contenu principal (strip nav/pub/footer)
3. Détection JSON-LD `schema.org/Recipe` → si trouvé, chemin fiable (voir ci-dessous)
4. Sinon : envoi du texte extrait à Gemini avec prompt de structuration
5. Gemini retourne un JSON structuré → conversion en `.gram`
6. Affichage du résultat + proposition de sauvegarde

**Marqué `--experimental`** : les sites changent, certains bloquent les scrapers. Résultats variables.

---

#### `gram import --jsonld <file|url>` — Import JSON-LD P2 `[ ]`

Convertit un fichier ou une URL JSON-LD (`schema.org/Recipe`) en `.gram`. **Plus fiable que le scraping** — beaucoup de sites exposent leurs recettes en JSON-LD pour le SEO.

```bash
gram import --jsonld recipe.json
gram import --jsonld "https://example.com/recette" --extract-jsonld
```

> **Astuce :** On peut extraire le JSON-LD d'une page HTML en cherchant `<script type="application/ld+json">`. C'est la méthode la plus robuste pour l'import web.

---

#### `gram import --cooklang <file>` — Import depuis Cooklang P3 `[ ]`

Convertit un fichier `.cook` (Cooklang) en `.gram`. Conversion best-effort (Cooklang n'a pas de quantités strictes).

```bash
gram import --cooklang brioche.cook
```

---

#### `gram export --format <format> <file>` — Export P3 `[ ]`

Export vers d'autres formats. PDF délibérément déprioritisé.

```bash
gram export --format markdown brioche.gram
gram export --format html brioche.gram
# PDF : non prioritaire, à reconsidérer si demande réelle
```

---

### Groupe 5 — Intégration 11ty

> **Contexte :** L'objectif est d'utiliser `@gram/cli` comme couche de données pour un site 11ty personnel — accessible depuis n'importe où (courses, cuisine). Le CLI génère les données structurées que 11ty consomme.

---

#### `gram sync` — Synchronisation vers 11ty P1 `[~]`

Compile toutes les recettes d'un dossier et écrit les JSON dans le dossier `_data/` de 11ty.

```bash
gram sync                                   # Utilise la config du projet
gram sync --recipes ./recipes/ --output ./_data/recipes/
gram sync --watch                           # Surveillance + re-sync automatique
```

**Fichiers générés :**
```
_data/
 recipes/
   brioche.json          ← JSON compilé d'une recette
   pasta-carbonara.json
   index.json            ← Index de toutes les recettes (titre, tags, timing...)
```

**Format `index.json` (pour les listings 11ty) :**
```json
[
 {
   "slug": "brioche",
   "title": "Brioche au beurre",
   "servings": 8,
   "tags": ["boulangerie", "sucré"],
   "times": { "total": "3h15", "active": "45min" },
   "source": "brioche.gram"
 }
]
```

**Workflow type avec 11ty :**
```bash
# Terminal 1 : surveille les recettes et régénère les JSON
gram sync --watch

# Terminal 2 : 11ty surveille les JSON et reconstruit le site
npx @11ty/eleventy --serve
```

> **Ou en une commande** avec `concurrently` dans `package.json` :
> ```json
> "dev": "concurrently \"gram sync --watch\" \"eleventy --serve\""
> ```

---

#### Templates 11ty suggérés P3 `[~]`

Exemples de templates Nunjucks pour consommer les données GRAM dans 11ty :

**Page recette (`recipe.njk`) :**
```njk
{% for ingredient in recipe.shopping_list %}
 <li>{{ ingredient.name }} — {{ ingredient.quantity }}{{ ingredient.unit }}</li>
{% endfor %}
```

**Vue "courses" (mobile-first) :**
Liste de courses interactive avec cases à cocher, optimisée pour smartphone.

> **Note :** Ce n'est pas dans le scope du CLI lui-même, mais documenter des templates de départ serait très utile.

---

### Groupe 6 — Intelligence artificielle (Gemini)

> **Provider :** Google Gemini via `@google/generative-ai`. Clé API dans `~/.config/gram/config.yaml` ou variable `GEMINI_API_KEY`.

---

#### `gram ai generate "<prompt>"` — Génération de recette P2 `[~]`

Génère une recette `.gram` complète depuis une description en langage naturel.

```bash
gram ai generate "une tarte aux pommes pour 6 personnes, style alsacien"
gram ai generate "pasta carbonara traditionnelle" --output carbonara.gram
gram ai generate "..." --model gemini-1.5-pro  # Modèle plus puissant si besoin
```

**Considérations :**
- Le prompt système doit inclure la **spécification complète de la syntaxe GRAM**
- Gemini génère du `.gram` valide → passage automatique par `gram check`
- Si `check` échoue → retry automatique avec le message d'erreur (max 2 retries)
- Coût estimé : ~2000-5000 tokens par recette (modèle flash)

---

#### `gram ai translate <file> --lang <code>` — Traduction P3 `[ ]`

Traduit une recette `.gram` dans une autre langue (noms d'ingrédients, instructions) en s'appuyant sur le package `@gram/i18n`.

```bash
gram ai translate brioche.gram --lang en
gram ai translate brioche.gram --lang es --output brioche-es.gram
```

---

#### `gram ai suggest <file>` — Suggestions P3 `[ ]`

Analyse une recette et suggère des améliorations : techniques manquantes, ingrédients optionnels, variantes.

```bash
gram ai suggest brioche.gram
```

---

### Groupe 7 — Outils développeur

#### `gram init` — Initialisation de projet P0 `[ ]`

Crée la structure `.gram/` pour un nouveau projet recettes.

```bash
gram init                  # Dans le dossier courant
gram init --path ~/recipes
```

**Structure créée :**
```
.gram/
 config.yaml   ← Config projet (template pré-rempli)
 db.yaml       ← Base d'ingrédients vide (avec quelques exemples)
 .gitignore    ← Exclut les données sensibles si besoin
```

---

#### `gram watch <dir>` — Surveillance P1 `[ ]`

Surveille un dossier et relance `gram check` (et optionnellement `gram sync`) à chaque modification.

```bash
gram watch .
gram watch recipes/ --check --sync    # Validation + sync 11ty en continu
```

---

#### `gram diff <v1.gram> <v2.gram>` — Diff sémantique P3 `[~]`

Compare deux versions d'une recette au niveau **sémantique** (pas juste textuel).

```bash
gram diff brioche-v1.gram brioche-v2.gram
```

**Sortie :**
```
Différences sémantiques entre brioche-v1.gram et brioche-v2.gram :

INGRÉDIENTS
 ~ farine   200g → 250g  (+25%)
 + levure   5g           (ajouté)
 - sel      2g           (supprimé)

TIMING
 ~ repos    1h → 2h      (+60min)

ÉTAPES
 ~ Étape 3 : instructions modifiées
```

> **Pourquoi c'est unique :** Un diff Git dit "ligne 3 a changé". Ce diff dit "la quantité de farine a augmenté de 25% et une étape de repos a été allongée". Seul un langage data-first comme GRAM peut faire ça.

---

#### `gram config` — Gestion de la configuration P1 `[ ]`

Lit et écrit la configuration sans éditer les fichiers manuellement.

```bash
gram config get ai.provider
gram config set ai.provider gemini
gram config set ai.model gemini-1.5-flash
gram config --global set ai.api_key "ma-cle"  # Config globale
gram config --list                             # Affiche toute la config active
```

---

## Roadmap d'implémentation

### Phase 1 — Fondations (faire fonctionner le pipeline)
- [ ] `gram init` — Créer la structure `.gram/`
- [ ] `gram check` — Validation avec exit codes et messages formatés
- [ ] `gram build` — Compilation vers JSON
- [ ] `gram view` — Visionneuse terminal (coloration ANSI)
- [ ] `gram config` — Lecture/écriture de la config

### Phase 2 — Valeur quotidienne
- [ ] `gram db extract` — Extraction d'ingrédients depuis les recettes
- [ ] `gram db validate` — Validation de la base
- [ ] `gram analyze` — Analyse complète d'une recette
- [ ] `gram shop` — Liste de courses (une ou plusieurs recettes)
- [ ] `gram sync` — Synchronisation vers 11ty + mode `--watch`

### Phase 3 — Puissance et confort
- [ ] `gram render` — Export Markdown/HTML
- [ ] `gram scale` — Redimensionnement de recette
- [ ] `gram plan` — Planification hebdomadaire
- [ ] `gram db search` — Recherche dans la base
- [ ] `gram watch` — Mode surveillance standalone
- [ ] `gram format` — Auto-formatage

### Phase 4 — Import et AI
- [ ] `gram db enrich` — Enrichissement AI via Gemini
- [ ] `gram import --jsonld` — Import JSON-LD (robuste)
- [ ] `gram import --url` — Import web (expérimental, via Gemini)
- [ ] `gram ai generate` — Génération de recette
- [ ] `gram db merge` — Fusion de bases

### Phase 5 — Fonctionnalités avancées (futur)
- [ ] `gram diff` — Diff sémantique
- [ ] `gram ai translate` — Traduction
- [ ] `gram ai suggest` — Suggestions
- [ ] `gram import --cooklang` — Import Cooklang
- [ ] Templates 11ty de départ

---

## Questions ouvertes

| # | Question | Décision |
|---|----------|----------|
| 1 | Framework CLI : `commander.js` vs `yargs` vs `citty` ? | À décider — `citty` est moderne et léger |
| 2 | Affichage terminal : `chalk` + `cli-table3` ou framework TUI complet (`ink`) ? | `chalk` + modules simples pour commencer |
| 3 | `gram view` : utiliser un pager (`less`) pour les longues recettes ? | Oui, avec détection automatique de la taille du terminal |
| 4 | `gram scale` : modifier le fichier source ou créer un nouveau fichier ? | Nouveau fichier par défaut (sécurité), `--in-place` pour modifier |
| 5 | Gestion des erreurs AI : que faire si Gemini est indisponible ? | Fallback gracieux avec message clair, jamais de crash silencieux |
| 6 | `gram sync` : doit-il supprimer les JSON orphelins ? | Oui, avec `--clean` flag et confirmation |

---

## Notes techniques

- **Package manager :** Bun (cohérent avec le reste du monorepo)
- **Language :** TypeScript ESM (cohérent avec les autres packages)
- **Build :** tsup (cohérent)
- **Tests :** Bun test
- **Dépendances attendues :**
 - `citty` ou `commander` — parsing des commandes
 - `chalk` — couleurs ANSI
 - `yaml` — lecture/écriture YAML (déjà dans `analyzer`)
 - `@google/generative-ai` — SDK Gemini (feature-gated)
 - `chokidar` — surveillance de fichiers pour `--watch`
 - `cli-table3` — tableaux dans le terminal


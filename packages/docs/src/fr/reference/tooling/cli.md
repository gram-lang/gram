# Interface en Ligne de Commande (CLI)

Le CLI officiel de GRAM (`@gram/cli`) est l'outil principal pour valider, compiler et gérer vos collections de recettes localement. Il agit comme un pont entre vos fichiers `.gram` et le reste de votre stack technique (SSG, Next.js, applications mobiles, etc.).

## Installation

Gram n'est pas encore publié sur un registre de paquets. Pour utiliser le CLI, clonez le dépôt et liez-le localement avec [Bun](https://bun.sh/) :

```bash
git clone https://codeberg.org/abiwab/gram.git
cd gram
bun install
cd packages/cli
bun link
```

> [!NOTE]
> Bun est requis pour compiler et exécuter le CLI, pas seulement pour installer les dépendances — le shebang du binaire compilé cible le runtime Bun directement, et certains chemins critiques du code (résolution de glob, ouverture de navigateur pour `gram print`) appellent des API spécifiques au runtime Bun sans équivalent Node.js. `npm`/`pnpm` ne sont pas des substituts viables ici.

---

## Commandes Principales

### Gestion de Projet & Flux de Travail Développeur

#### `gram init`
Initialise un nouvel environnement GRAM dans le dossier courant.
- Crée un dossier `.gram/`.
- Génère un fichier `config.yaml` vierge et sans commentaires.
- Configure de manière interactive votre langue de recette préférée (actuellement `en` ou `fr`).
- Configure de manière interactive votre fournisseur d'IA et modèle préférés.
- Génère/met à jour un fichier `.env` pour vos clés d'API IA.
- Génère une base de données d'ingrédients de départ très commentée à `.gram/ingredients.yaml`.
- Génère un `.gitignore` pour éviter de versionner des clés sensibles.

#### `gram check [motif]`
Valide vos fichiers `.gram` pour détecter les erreurs de syntaxe, l'intégrité structurelle, et les ingrédients non définis.
- Exécute l'analyseur (parser) OhmJS pour attraper les erreurs de syntaxe.
- Exécute le compilateur Kitchen pour attraper les erreurs structurelles (ex : dépendances cycliques).
- Se connecte à votre `ingredients.yaml` pour vous avertir des ingrédients non documentés dans votre base de données.
- Options : `--db <chemin>`, `--skip-db`.

#### `gram build [motif]`
Compile vos recettes `.gram` dans le format final JSON minifié.
```bash
gram build "**/*.gram" --output ./dist
gram build brioche.gram --pretty
gram build brioche.gram --scale 2 --output ./dist-double
```
- Par défaut, sort le JSON pur directement sur la sortie standard (`stdout`) pour faciliter le chaînage (piping).
- Calcule automatiquement les données nutritionnelles et la standardisation des masses physiques via la base de données.
- `--scale <facteur>` intègre la mise à l'échelle directement dans la sortie JSON. Le mode référence (ex. `farine=300g`) n'est pas disponible ici volontairement : `build` peut traiter plusieurs fichiers à la fois, et une sortie par lot reproductible ne doit pas dépendre de la lecture de la liste de courses d'un fichier spécifique au préalable. Utilisez `gram view`/`gram scale` pour trouver le facteur que vous voulez, puis passez ce facteur numérique à `build`.
- Options : `--output/-o <dossier>`, `--pretty`, `--scale <facteur>`, `--db <chemin>`, `--skip-db`.

#### `gram view <fichier>`
Affiche une recette directement dans le terminal dans une belle boîte ASCII.
```bash
gram view brioche.gram                      # Vue par défaut
gram view brioche.gram --scale 2            # Voir avec des quantités doublées
gram view brioche.gram --scale farine=300g  # Voir mis à l'échelle pour farine = 300g
```
- Prend en charge la pagination automatique pour les recettes longues.
- Affiche la nutrition calculée, les minutages, et les listes d'ingrédients à cocher.
- Avec `--scale`, toutes les quantités d'ingrédients (liste de courses et références dans les étapes) sont ajustées.
- Options : `--scale <facteur|réf>`, `--no-pager`, `--skip-db`, `--db`, `--bakers-math`, `--bakers-reference <id>`, `--bakers-math-only`.

#### `gram import <source>`
Importe une recette depuis un fichier JSON-LD ou une URL et la convertit en un fichier `.gram` à l'aide de l'IA.
- Extrait automatiquement le contenu `application/ld+json` des sites web.
- Traduit et formate la recette en une syntaxe Gram valide, en respectant la configuration `language`.
- Nécessite qu'une IA soit configurée (voir `config.yaml`).
- Options : `--output <fichier>`.

#### `gram shop [motif]`
Génère une liste de courses agrégée pour plusieurs recettes.
```bash
gram shop "**/*.gram"                 # Toutes les recettes
gram shop brioche.gram --scale 2      # Doubler toutes les quantités
gram shop "menus/*.gram" --scale 4    # Batch cooking × 4
```
- Agrège intelligemment les quantités via la densité (volume → grammes quand la densité est connue).
- Regroupe les ingrédients par leur champ `category` (famille culinaire : Fruits & Légumes, Produits Laitiers, Céréales, etc.).
- **Regroupement par alias** : si deux recettes utilisent des noms différents pour le même ingrédient (ex : `butter` et `beurre`), ils sont fusionnés sous la clé canonique via les alias de la base de données.
- Les ingrédients sans quantité (ex : `@sel{}`) sont listés à côté de leur entrée principale plutôt que dans une section séparée.
- Supporte les petites unités : `pincée`, `trait`, `goutte` sont gérées sans erreurs d'agrégation.
- `--scale <facteur>` applique un multiplicateur numérique à toutes les recettes (uniquement facteur — le mode référence n'est pas disponible pour plusieurs fichiers).
- Options : `--format terminal|md|json`, `--output/-o <fichier>`, `--scale <facteur>`, `--db`, `--skip-db`.

#### `gram cook <fichier>`
Lance un guide de cuisine interactif étape par étape directement dans le terminal.
```bash
gram cook brioche.gram
gram cook carbonara.gram --skip-db
```
**Déroulement :**
1. **Mise en place** — liste complète et agrégée des ingrédients pour la recette (Espace pour commencer)
2. **Intro de section** — ingrédients pour la section à venir (agrégés, montrés avant chaque section)
3. **Étapes de cuisson** — une étape à la fois dans une disposition en deux colonnes : ingrédients à gauche, instructions à droite
4. **Écran de fin** — temps total passé

Les ingrédients sont **agrégés par section** : les utilisations répétées du même ingrédient dans une section sont regroupées en une seule entrée avec les quantités jointes (ex : `200g beurre` + `50g beurre` → affiché comme `200g + 50g beurre`, non additionné arithmétiquement). Le panneau des ingrédients montre toutes les quantités nécessaires pour cette section d'un seul coup d'œil.

**Minuteurs** — les minuteurs annotés dans la recette (`~label{30min}`) apparaissent dans la vue de l'étape :
- Appuyez sur `T` pour lancer un minuteur ; s'il y en a plusieurs de disponibles, un sélecteur apparaît.
- Les minuteurs s'exécutent en arrière-plan — ils restent visibles pendant que vous avancez dans les étapes.
- Une cloche (bell) du terminal retentit et l'affichage du minuteur passe à un état statique "terminé" quand il arrive à zéro.
- `Q`/`Échap` déclenchent le flux de confirmation de sortie plutôt que de rejeter un minuteur terminé.

**Raccourcis clavier :**
| Touche | Action |
|---|---|
| `Espace` / `Entrée` | Étape suivante |
| `B` | Étape précédente |
| `T` | Lancer un minuteur |
| `Q` / `Échap` | Quitter (demande confirmation si un minuteur est en cours) |

- Options : `--scale <facteur|réf>`, `--skip-db`, `--db`.

#### `gram diff <fichier> [fichier-b]`
Affiche un diff sémantique d'une recette — en comparant les ingrédients, les minutages, les sections, les températures, les minuteurs et le frontmatter, plutôt que le texte brut.
```bash
gram diff brioche.gram                        # Arbre de travail vs HEAD (plus courant)
gram diff brioche.gram --ref HEAD~2           # vs un commit git spécifique
gram diff brioche.gram --ref v1.2             # vs un tag git
gram diff brioche-v1.gram brioche-v2.gram     # Deux fichiers explicites (pas besoin de git)
```
Le diff couvre **six axes** :
- **Ingrédients** — quantités ajoutées/retirées/modifiées, avec le `percentChange` quand les unités correspondent.
- **Minutages** — `totalTime`, `cookTime`, `activeTime`, `preparationTime` en minutes.
- **Sections** — sections ajoutées/retirées et changements du nombre d'étapes.
- **Frontmatter** — modifications sur `portions`, `description`, et d'autres champs de métadonnées. Un changement de `title` est suivi séparément et affiché sur sa propre ligne au-dessus du bloc frontmatter.
- **Préparations** — modes de préparation modifiés par ingrédient (ex : "en dés" → "émincé").
- **Températures & Minuteurs** — cibles de température et durées de minuteur ajoutées/retirées/modifiées par section.

- Fonctionne sur des objets compilés (sortie de Kitchen), pas du texte brut — un reformatage syntaxique ne produit aucun diff.
- Le mode Git nécessite que le fichier soit suivi. Renvoie une erreur gracieuse si `git` est indisponible.
- Options : `--ref <réf-git>`.

#### `gram scale <fichier>`
Affiche une comparaison avant/après des quantités d'ingrédients à une échelle donnée.
```bash
gram scale brioche.gram --scale 2            # Doubler toutes les quantités
gram scale brioche.gram --scale 0.5          # Diviser par deux toutes les quantités
gram scale brioche.gram --scale farine=300g  # Mettre à l'échelle pour farine = 300g
gram scale brioche.gram --scale oeufs=3      # Mettre à l'échelle pour oeufs = 3
```
- Affiche un tableau de comparaison : quantités d'origine (estompées) vs mises à l'échelle (en vert).
- Les quantités qui ne peuvent pas être mises à l'échelle (valeurs textuelles comme "1 pincée") sont listées séparément.
- Avertit sur les facteurs extrêmes (en-dessous de ×0.1 ou au-dessus de ×20) et note que les temps de cuisson ne sont pas ajustés.
- Le mode référence (`id=valeur`) calcule le facteur à partir de la quantité actuelle de l'ingrédient. L'ID doit correspondre à la clé de l'ingrédient dans la recette. Les unités de la même famille se convertissent automatiquement (ex. `farine=1kg` pour une recette écrite en `500g`); le passage masse↔volume (ex. `eau=150g` pour une recette en `ml`) fonctionne aussi dès lors qu'une densité est disponible — provenant de `gram db enrich`, ou d'une surcharge `densities: ["eau:1.0"]` dans le frontmatter de la recette elle-même.
- Tous les ingrédients ne peuvent pas être une cible de référence : les ingrédients fixes (`@=`), les quantités relatives (`70% @&farine`), les ingrédients utilisés uniquement dans une sous-recette, les ingrédients dans un groupe d'alternatives, et les ingrédients divisés entre des unités incompatibles sont rejetés avec une erreur spécifique expliquant pourquoi. Voir la [Analyse approfondie : Mise à l'échelle](/fr/explanation/scaling) pour la liste complète.
- Options : `--scale <facteur|réf>`, `--skip-db`, `--db`.

#### `gram watch [dossier]`
Observe un dossier pour les modifications de fichiers `.gram` et relance `gram check` automatiquement à chaque sauvegarde.
```bash
gram watch                              # Observe la racine du projet
gram watch recettes/                    # Observe un dossier spécifique
gram watch --build --output ./dist      # Compile aussi les fichiers modifiés en JSON
```
- Affiche une ligne de résultat horodatée par changement : `[12:34:01] ✓ brioche.gram` ou `✗ brioche.gram — 1 error`.
- Les erreurs sont affichées en ligne en dessous du nom de fichier — le watcher ne s'arrête jamais sur une erreur.
- Un délai antirebond (debounce) de 150ms évite les exécutions redondantes.
- Options : `--build`, `--output/-o <dossier>`, `--skip-db`, `--db`.

#### `gram suggest`
Trouve des recettes dans votre projet qui utilisent un ensemble donné d'ingrédients.
```bash
gram suggest --with "beurre, oeufs"
gram suggest --with "poulet" --without "crème"
gram suggest --with "citron, ail" --top 5 --min-match 50
gram suggest --with "butter" --json           # prise en compte des alias: butter → beurre
```
- Parcourt tous les fichiers `.gram` en parallèle — utilise uniquement le parser (sans la compilation complète du pipeline), c'est donc rapide même sur de grandes collections.
- **Correspondance tenant compte des alias** : si une base de données est configurée, les noms d'ingrédients sont résolus via l'index d'alias. Chercher `"butter"` fera correspondre les recettes contenant `@beurre`.
- Attribue un score à chaque recette par pourcentage de correspondance (`correspondance / total avec-termes`). Utilisez `--min-match` pour filtrer les résultats à faible score.
- `--without` exclut immédiatement toute recette contenant un de ces ingrédients.
- Options : `--with/-w <csv>`, `--without <csv>`, `--top/-n <n>` (défaut 10), `--min-match <0–100>` (défaut 1), `--pattern <glob>`, `--db`, `--skip-db`, `--json`.

#### `gram print <fichier>`
Génère un HTML prêt pour l'impression et l'ouvre dans le navigateur par défaut.
```bash
gram print brioche.gram                   # Générer et ouvrir
gram print brioche.gram --scale 2         # Imprimer avec quantités doublées
gram print brioche.gram --no-open         # Ne pas ouvrir, imprimer le chemin sur stdout
```
- Le HTML est écrit dans un fichier temporaire (`gram_print_<horodatage>.html` dans le dossier temporaire du système) et ouvert avec le navigateur par défaut (`open` sur macOS, `xdg-open` sur Linux, `cmd /c start` sur Windows).
- Sortie identique à `gram export --format html` — idéal pour la boîte de dialogue d'impression du navigateur (`Ctrl+P` / `Cmd+P`) pour produire un PDF A4.
- `--no-step-qty` — masque les quantités d'ingrédients dans le texte des étapes.
- Options : `--no-open`, `--scale <facteur|réf>`, `--no-step-qty`, `--skip-db`, `--db`, `--bakers-math`, `--bakers-reference <id>`, `--bakers-math-only`.

#### `gram export <fichier>`
Exporte une recette vers Markdown ou HTML prêt à l'impression.
```bash
gram export brioche.gram --format md                   # brioche.md à côté de la source
gram export brioche.gram --format html -o ~/print.html # chemin de sortie explicite
gram export brioche.gram --format html --scale 2       # exporter aux quantités doublées
```
- `--format md` — Markdown standard avec une liste de courses, l'équipement et les étapes numérotées.
- `--format html` — Document HTML A4 autonome avec CSS intégré pour l'impression, avec icônes SVG Lucide (pas de dépendances externes). Il charge Courier Prime et Inter depuis Google Fonts, donc une connexion réseau est requise lors de la première ouverture.
- Chemin de sortie par défaut : le même dossier que le fichier source, avec l'extension remplacée (`.gram` → `.md` ou `.html`).
- `--no-step-qty` — masque les quantités d'ingrédients dans le texte des étapes. **Format HTML uniquement** — sans effet avec `--format md`.
- Options : `--format md|html`, `--output <chemin>`, `--scale <facteur|réf>`, `--no-step-qty`, `--skip-db`, `--db`, `--bakers-math`, `--bakers-reference <id>`, `--bakers-math-only`.

#### `gram format [motif]`
Auto-formate les fichiers `.gram` en appliquant 9 règles textuelles sur place.
```bash
gram format                              # Formater tous les fichiers *.gram
gram format brioche.gram                 # Formater un fichier unique
gram format "recettes/**/*.gram" --check # Vérif CI — exit 1 si un fichier a besoin d'être formaté
```
**Règles appliquées (dans cet ordre) :**
1. **ID d'ingrédients en minuscules** — `@Farine` → `@farine`
2. **Espace avant l'accolade** — `@ing {10g}` → `@ing{10g}`
3. **Espaces dans les accolades** — `@ing{ 10g }` → `@ing{10g}`
4. **Zéros décimaux finaux** — `{500.0g}` → `{500g}`, `{1.50g}` → `{1.5g}`
5. **Espacement des températures** — `{180 °C}` → `{180°C}`
6. **Espaces finaux** — supprime les espaces et tabulations en fin de ligne
7. **Max 2 lignes vides consécutives** — réduit les suites de 4+ sauts de ligne à 3
8. **2 lignes vides avant les en-têtes de section** — normalise l'espacement des `##`
9. **Un seul saut de ligne à la fin du fichier (EOF)**

Sortie par fichier : `✔ brioche.gram  2 IDs lowercased · 1 trailing zero removed`
Le formateur est idempotent — l'exécuter deux fois ne produit aucun autre changement.
- Options : `--check`.

### Configuration

Commandes imbriquées sous `gram config` pour lire et écrire la configuration projet (ou globale).

#### `gram config list`
Affiche toutes les valeurs de configuration de la config du projet local et de la config globale.
```bash
gram config list
```

#### `gram config get <clé>`
Affiche une seule valeur de configuration sur stdout.
```bash
gram config get ai.provider      # → google
gram config get database         # → .gram/ingredients.yaml
gram config get ai.provider --global
```

#### `gram config set <clé> <valeur>`
Définit une valeur de configuration.
```bash
gram config set database ./ma-bdd.yaml
gram config set ai.provider google
gram config set ai.apiKey AIza...           # Écrit GEMINI_API_KEY dans .env
gram config set database ./bdd-globale.yaml --global
```
- Les valeurs sont écrites dans `.gram/config.yaml` par défaut ; utilisez `--global` pour `~/.config/gram/config.yaml`.
- Les clés sensibles (`ai.apiKey`) sont toujours écrites dans le fichier `.env` du projet. Le nom de la variable d'environnement est dérivé du fournisseur configuré (ex : `google` → `GEMINI_API_KEY`).
- Les nombres et booléens sont coercés automatiquement (`"2"` → `2`, `"true"` → `true`).

#### `gram config unset <clé>`
Supprime une valeur de configuration.
```bash
gram config unset ai.model
gram config unset ai.apiKey         # Supprime la var d'environnement de la clé API du .env
```

---

### Gestion de Base de Données

Commandes imbriquées sous `gram db` pour gérer votre `ingredients.yaml`.

::: tip Flux de Travail Recommandé
Exécutez toujours dans cet ordre :
```
gram db sync → gram db lint → gram db enrich
```
Lancer `lint` avant `enrich` évite de gaspiller des appels d'IA à enrichir des ingrédients qui seront plus tard fusionnés en tant que doublons.
Utilisez `gram db search` à tout moment pour inspecter les entrées et vérifier si c'est complet. Utilisez `gram db merge` pour intégrer une base de données externe à la vôtre.
:::

#### `gram db sync [motif]`
**Étape 1/3.** Parcourt vos recettes pour trouver des ingrédients non documentés et les ajoute à votre base de données.
- La correspondance approximative (fuzzy matching via Levenshtein) interactive vous aide à éviter les doublons pour les pluriels ou les fautes de frappe.
- Options : `--dry-run/-n` (aperçu sans écriture), `--db <chemin>`.

#### `gram db lint`
**Étape 2/3.** Utilise l'IA pour détecter et résoudre les doublons sémantiques et les pluriels dans votre base de données.
- Détecte les doublons inter-langues (ex : `sucre` / `sugar`) et les formes plurielles (ex : `oeufs` → `oeuf`).
- Pour chaque doublon, vous laisse choisir quelle clé conserver — la clé supprimée est automatiquement ajoutée comme alias.
- Affiche un diff nutritionnel (uniquement les champs qui diffèrent) quand les deux entrées ont des données contradictoires, pour que vous puissiez faire un choix éclairé.
- Options : `--report/-r` (afficher les problèmes sans appliquer les corrections), `--db <chemin>`.

#### `gram db enrich`
**Étape 3/3.** Utilise l'IA pour compléter automatiquement les données manquantes dans votre base de données.
- Enrichit les champs `density`, `unit_weight`, `nutrition`, `category`, et `tags` par lots (`unit_weight` est rempli avec `density`).
- `category` est une famille culinaire (ex : Légumes, Produits Laitiers, Céréales) — distincte des `tags` libres.
- Idempotent : peut être relancé en toute sécurité, ne remplit que les champs qui sont encore manquants.
- Options : `--ingredient <slug>` (enrichir une seule entrée), `--field density|nutrition|tags|category|all` (défaut `all`), `--dry-run/-n`, `--db <chemin>`.

#### `gram db validate`
Valide l'intégrité de votre `ingredients.yaml`.
- Vérifie les erreurs de schéma, les alias dupliqués, et les valeurs incohérentes (ex : densité > 2.5).
- Options : `--strict` (exit 1 sur avertissements, utile en CI).

#### `gram db search [requête]`
Cherche et affiche les entrées d'ingrédients en détail.
```bash
gram db search beurre            # Correspondance partielle sur id, nom, ou n'importe quel alias
gram db search --tag laitier     # Tous les ingrédients tagués 'laitier'
gram db search --category Grains # Tous les ingrédients dans la catégorie Grains
gram db search --missing nutrition  # Entrées n'ayant pas encore de données nutritionnelles
gram db search --exact beurre --count  # Imprimer seulement le nombre de correspondances
```
- Options : `--tag <tag>`, `--category/-c <category>`, `--missing nutrition|physical|aliases`, `--exact`, `--count`, `--json`, `--db <chemin>`.

#### `gram db merge <source.yaml>`
Fusionne une base de données d'ingrédients externe avec votre base locale.
```bash
gram db merge ~/shared-ingredients.yaml          # Résolution de conflit interactive
gram db merge community.yaml --prefer remote     # Utilise toujours les valeurs distantes en cas de conflit
gram db merge community.yaml --only-new          # Ajoute seulement les nouvelles entrées, passe la résolution de conflit
```
La fusion prend en compte les **alias** : si votre base a `butter` avec l'alias `beurre`, et que la source a une entrée `beurre`, ils sont reconnus comme étant le même ingrédient.
- Options : `--prefer local|remote` (défaut `local`), `--dry-run`, `--only-new`, `--db <chemin>`.

---

## Détails du Fichier de Configuration

Le CLI fusionne la configuration depuis `~/.config/gram/config.yaml` (globale) et `.gram/config.yaml` (projet).

### Configuration IA en Cascade
GRAM utilise une hiérarchie de secours (fallback) en cascade pour les identifiants sensibles comme les clés API de l'IA :
1. **Variables d'Environnement** : Les variables comme `GEMINI_API_KEY` (du système ou d'un fichier `.env`) ont la priorité absolue. C'est la façon **recommandée** de stocker des secrets localement et dans des environnements CI/CD.
2. **Secours `config.yaml`** : Si la variable d'environnement manque, GRAM se rabat sur le champ `ai.apiKey` de votre `config.yaml`. 

::: warning Protégez vos Clés !
Stocker votre `apiKey` dans `config.yaml` est fortement déconseillé si vous versionnez votre dossier `.gram` avec Git, car cela exposerait votre clé secrète.
:::

### Paramètres de `config.yaml`

Voici la référence complète de tous les paramètres disponibles dans `config.yaml` :

```yaml
version: 1                     # Réservé aux futures migrations de configuration — inutilisé pour le moment
database: ".gram/ingredients.yaml" # Chemin relatif ou absolu vers la base de données
language: "fr"                 # Langue pour tout le contenu généré par l'IA (catégories, tags, recettes importées)
                               # Supporté : en, fr, de, es, it, pt, nl, ja, zh — défaut : en

# Paramètres IA pour `gram import`, `gram db enrich` et `gram db lint`
ai:
  # Fournisseurs supportés : "google", "openai", "anthropic", "ollama"
  provider: "google"
  
  # Chaîne de modèle spécifique (défaut 'gemini-3.5-flash' pour google,
  # 'gpt-4.1-nano' pour openai, 'claude-haiku-4-5-20251001' pour anthropic, 'llama4' pour ollama)
  model: "gemini-3.5-flash"
  
  # Clé API (Peut aussi utiliser des variables ENV : GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY —
  # pour n'importe quel nom de fournisseur personnalisé/autre, GRAM_API_KEY est utilisé comme repli générique.
  # Note : le fournisseur "ollama" ne lit aucune clé API, ni de la config ni de l'environnement.)
  # ATTENTION : Préférez utiliser un fichier .env au lieu de versionner ce fichier avec votre clé.
  apiKey: "VOTRE_CLE_API"
  
  # URL de base personnalisée — uniquement lue pour le fournisseur "ollama".
  # Vaut "http://localhost:11434/v1" (ou la var ENV OLLAMA_BASE_URL) par défaut.
  baseUrl: "http://localhost:11434/v1"
```

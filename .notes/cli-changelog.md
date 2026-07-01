# @gram/cli — Changelog

Development history of the `packages/cli` package. Entries are ordered from most recent to oldest.

---

## [Import Prompt v2 — Robust AI Spec] — 2026-06-23

### Added

#### New: `src/prompts/gram-spec.ts`

- **`GRAM_SPEC_PROMPT`** extracted from `services/importer.ts` into a dedicated, versioned file (`GRAM_SPEC_VERSION: 2`). Each section maps 1-to-1 to a `docs/syntax_details/` document for easy future updates.
- **Section 1 — Conversion process**: Five explicit mental steps the model must follow before writing any output: structure analysis → frontmatter → ingredient mapping → step writing → review.
- **Section 2 — Frontmatter**: All fields documented (`portions` replaces the erroneous `servings`, added `originalTitle`, `description`, `notes`, `densities`, `size`).
- **Section 3 — Ingredients**: Full rewrite covering real names with spaces (`@olive oil{2 tbsp}`, not `@olive-oil`), all five modifiers (`?`, `-`, `*`, `=`, `&`), the `@&` reference rule for second occurrences, inline preparations, aliases, alternatives, composites (`<@`), relative quantities (`{70% @&flour}`).
- **Section 4 — Cookware**: Critical rule made explicit: `{}` accepts integers only — dimensions and materials go in `()`. Scaling table (fixed / scalable / forced-fixed).
- **Section 5 — Timers & Temperatures**: Sync vs async timers (`~{10min}` vs `~&{45min}`), named timers, ranges. Exact, semantic and named temperature formats.
- **Section 6 — Intermediate preparations**: Declaration scope (step vs section title), usage syntax (`&name` without `@`), lifecycle rules.
- **Section 7 — Anti-patterns**: Seven categories of common AI mistakes with ❌/✅ pairs (kebab-case names, units in cookware braces, free text in qty braces, `@&` on first use, spaces around `<`, space before prep parenthesis, markdown fences in output).
- **Section 8 — Reference example**: A multi-section recipe using composites, retroplanning, async timers, `@=` fixed modifier, intermediates, and alternatives.

### Fixed

- **Critical bug in v1 prompt**: the old `GRAM_SPEC_PROMPT` instructed the model to use `@slug{qty}` in kebab-case (`@olive-oil`). The `.gram` format requires real ingredient names with spaces (`@olive oil{}`). The new prompt corrects this with multiple examples and a dedicated anti-pattern section.

### Changed

- **`services/importer.ts`**: `GRAM_SPEC_PROMPT` constant removed; now imported from `../prompts/gram-spec`.

---

## [Phase 4 — Multi-provider AI & Heuristic Import] — 2026-06-21

### Added

#### Multi-provider AI (`core/ai.ts`)

- **`loadAiModel(config)`** replaces `loadAiClient(config)`. Returns a `LanguageModel` from the Vercel AI SDK instead of a `GoogleGenerativeAI` client, making all AI calls provider-agnostic.
- **Provider auto-detection**: if `ai.provider` is not set in config, the function falls back to env-var detection in order — `GEMINI_API_KEY` → `OPENAI_API_KEY` → `ANTHROPIC_API_KEY`. First key found wins.
- **Supported providers** (via `@ai-sdk/*` packages):
  - `google` — Gemini via `@ai-sdk/google`. Default model: `gemini-2.0-flash`.
  - `openai` — OpenAI via `@ai-sdk/openai`. Default model: `gpt-4o-mini`.
  - `anthropic` — Anthropic via `@ai-sdk/anthropic`. Default model: `claude-haiku-4-5-20251001`.
  - `ollama` — Local models via `@ai-sdk/openai-compatible` against `http://localhost:11434/v1` (configurable via `ai.baseUrl` or `OLLAMA_BASE_URL`). Default model: `llama3.2`.
- **`GramConfig.ai`** — `provider` is now a typed union (`'google' | 'openai' | 'anthropic' | 'ollama'`); `baseUrl` field added for Ollama / custom endpoints.
- **New dependencies**: `ai`, `@ai-sdk/google`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible`. `@google/generative-ai` removed.

#### `gram import --ai` — AI-powered semantic import mode

- **`commands/import.ts`** — new `--ai` boolean flag. When set, loads the configured model via `loadAiModel()` and delegates to `importWithAI()`. Reports the active model to stderr so stdout stays clean (pipe-safe). Falls back gracefully to heuristic import if the AI call fails.
- **`services/importer.ts`** — `importWithAI(source, model)` function: fetches and parses the JSON-LD, passes the full recipe object to the model with `GRAM_SPEC_PROMPT` as system prompt, strips any accidental markdown fences from the response.
- The heuristic `importJsonLd()` path remains unchanged and is the default (`--ai` opt-in).

#### Heuristic import improvements (`services/importer.ts`)

- **Unicode fraction normalization** — `½`, `⅓`, `¾`, `⅛` etc. are converted to decimal equivalents before ingredient parsing (prevents parse failures on common blog formatting).
- **`recipe-ingredient-parser-v3`** — integrated as the primary ingredient parser for English-format strings. Falls back to the regex chain when the parser returns no result or throws (e.g. French quantities).
- **`name` field** on `ParsedIngredient` — tracks the human-readable ingredient name separately from the slug, used for fuzzy step annotation.
- **`annotateStep(text, ingredients)`** — uses `matchInText()` from `core/fuzzy.ts` to locate ingredient names inside step text and replace them with `@slug{qty unit}` references. Processes longest names first to prevent partial-match collisions.
- **`generateGram(recipe, ingredients)`** — dedicated function for heuristic `.gram` generation, extracted from the original monolithic flow.
- **`toSlug()` fix** — Unicode diacritic stripping now uses the standard `\p{M}/gu` Unicode property instead of the fragile hardcoded range `[̀-ͯ ]`.

#### `core/fuzzy.ts` — `matchInText()`

- **`matchInText(needle, haystack)`** — locates the first fuzzy occurrence of a multi-word ingredient name inside a step string. Returns `{ start, end }` or `null`. Complements the existing `similarity()` / `findSimilarInDb()` functions.

### Changed

- **`commands/db/enrich.ts`** and **`commands/db/lint.ts`** — updated to call `loadAiModel(config)` and pass a `LanguageModel` instead of the old `GoogleGenerativeAI` client. Internal AI call logic in `db-enricher.ts` and `db-linter.ts` migrated to `generateText()` / `generateObject()` from the `ai` package.

---

## [i18n & Dependencies] — 2026-06-21

### Added

- **`zod`** added as an explicit direct dependency (`package.json`). Previously pulled in transitively; making it explicit prevents version drift when transitive chains change.

### Fixed

- **Remaining French strings translated to English** across five files:
  - `commands/db/lint.ts` — spinner messages, confirmation prompts
  - `commands/db/sync.ts` — fuzzy-match select labels and warnings
  - `commands/init.ts` — overwrite confirmation prompt
  - `services/db-enricher.ts` — batch progress and error messages
  - `ui/db-lint.ts` — all issue labels, section headers, and summary lines

---

## [Phase 3b — DB Intelligence] — 2026-06-21

### Added

#### `@gram/analyzer` — Suppression du fallback pluriel naïf

- **`src/ingredient_db.ts`** — Retrait du bloc `endsWith('s')` dans `getIngredientData`. La résolution ne couvre plus que les clés exactes et les aliases déclarés explicitement. Le moteur reste strictement déterministe et agnostique des langues (plus de faux positifs sur "ananas", "radis"). L'intelligence linguistique appartient désormais exclusivement au CLI via `sync` et `lint`.

#### Nouveau : `core/fuzzy.ts`

- **`similarity(a, b)`** — Distance de Levenshtein normalisée (0–1), implémentée inline (~20 lignes, zéro dépendance)
- **`findSimilarInDb(newId, db, threshold=0.80)`** — Compare un ID contre toutes les clés de la DB. Retourne le meilleur match si `score >= threshold && score < 1`. Seuil 0.80 : attrape les pluriels simples (`oeufs/oeuf` = 80%) et les fautes de frappe (`farrine/farine` = 86%), sans faux positifs courts (`sel/miel` = 20%)

#### `gram db sync` — Refactoring en 3 phases + fuzzy interactif

- **`services/db-sync.ts`** — Remplace `syncIngredients()` par deux fonctions publiques distinctes :
  - `analyzeIngredients(files, db, config, opts)` → `DbSyncAnalysis` : phase mémoire pure, collecte les IDs, les classe en `exactMatches` / `fuzzyMatches` / `genuinelyNew`. Utilise `getIngredientData` pour le match exact (clé + alias), puis `findSimilarInDb` pour le fuzzy
  - `applySync(analysis, decisions, opts)` → `DbSyncResult` : phase écriture YAML AST. Crée les nouvelles entrées (`'new'`) et injecte les IDs comme alias dans les nodes existants (`'alias-of:<id>'`) via `isSeq` / `isMap`
- **`commands/db/sync.ts`** — Boucle interactive entre les deux phases : en TTY, chaque `fuzzyMatch` déclenche un `@clack/prompts select` (alias recommandé / nouvelle entrée / ignorer). En mode non-TTY/CI : fallback silencieux `'new'` avec `log.warn`
- **`ui/db-sync.ts`** — Affiche les entrées aliasées (`~` bleu) distinctement des nouvelles entrées (`+` vert)

#### `gram db lint` — Nouvelle commande IA

- **`services/db-linter.ts`** *(nouveau)* — `lintDb(db, config, ai, opts)` → `LintResult` :
  - Envoie toutes les clés + noms à Gemini (`gemini-2.0-flash` par défaut), prompt ciblé pour les pluriels (`'plural'`) et doublons sémantiques (`'duplicate'`)
  - Validation Zod du résultat Gemini + guard anti-hallucination (tous les IDs doivent exister réellement dans la DB)
  - Détecte les `hasNutritionConflict` pour les doublons où les deux entrées ont une nutrition renseignée
- **`applyLintDecisions(result, decisions)`** — Mutations YAML AST :
  - Pluriels : absorbe l'entrée aliasId dans le node keepId (fusion aliases + suppression de la clé), ou injecte simplement l'alias si aucune entrée séparée n'existe
  - Doublons : merge complet — nutrition (au choix), `physical`, aliases, puis suppression de la clé source
  - Helpers internes `_addAliasesToNode` et `_deleteKey` (dédupliqués via `Set`)
  - Re-triage alphabétique + espacement après écriture
- **`ui/db-lint.ts`** *(nouveau)* — `renderLintReport()` (lecture seule), `promptLintDecisions()` (boucle `@clack/prompts select` par issue), `renderLintSummary()`
- **`commands/db/lint.ts`** *(nouveau)* — Spinner Gemini, guard non-TTY, `--report` / `-r` pour affichage sans modification, aide inline
- **`commands/db/index.ts`** — Enregistrement de `lint`

#### Nouveaux types (`types.ts`)

- `FuzzyMatch` — `{ newId, existingId, score }`
- `DbSyncAnalysis` — `{ dbPath, allIds: Map<string,string>, exactMatches, fuzzyMatches, genuinelyNew }`
- `DbSyncResult` — Étendu avec `aliasedIngredients: string[]`
- `LintIssueType` — `'plural' | 'duplicate'`
- `LintIssue` — `{ type, ids, suggestion: { keepId, aliasIds }, hasNutritionConflict }`
- `LintResult` — `{ dbPath, issues }`
- `LintOptions` — `{ report?, dbPathOverride? }`

---

## [Phase 3 — Visualisation, Import, Enrichissement IA] — 2026-06-21

### Added

#### Nouvelle dépendance

- **`@google/generative-ai: ^0.24.1`** — SDK Gemini pour `gram db enrich` et `gram db lint`

#### Nouveau : `core/ai.ts`

- **`loadAiClient(config)`** — Initialise un client `GoogleGenerativeAI`. Priorité : `GEMINI_API_KEY` (env) > `config.ai.apiKey`. Lève `GramCLIError` si absent. Constante `DEFAULT_AI_MODEL = 'gemini-2.0-flash'` centralisée

#### `gram view <file>` — Nouvelle commande

- **`services/viewer.ts`** — `buildViewModel(file, opts)` → `RecipeViewModel` :
  - Pipeline complet (parser → kitchen → analyzer si DB disponible)
  - Gestion des tokens de step mixtes : strings, refs sans `type` (ingrédients/ustensiles), `temperature`, `timer`, `comment`, `declaration`
  - `stepToText()` : reconstruction propre du texte avec espacement intelligent (pas d'espace après apostrophe, espace post-token inline)
  - Filtre des ingrédients de section : `type !== 'alternative' && qty != null`
  - Shopping list depuis `analyzed.result.shopping_list` si disponible, sinon `compiled.shopping_list`
  - `formatQty()` : gère les quantités number, string, et objets (`TextQuantity`, `range`, `value`)
- **`ui/viewer.ts`** — `outputRecipe(model, noPager)` :
  - Rendu en box ASCII : header (`┌─ Titre ─┐`), temps (prep/active/rest/total), sections avec liste d'ingrédients + étapes numérotées, nutrition (4 macros + sodium/fibres optionnels), ingrédients manquants
  - Pager automatique (`less -R --quit-if-one-screen`) si sortie TTY et contenu > 85% du terminal
  - Chalk force-enabled avant spawn du pager (`chalk.level` sauvegardé/restauré) pour préserver les couleurs dans le pipe
- **`commands/view.ts`** — Args : `file` (positional), `--db`, `--skip-db`, `--no-pager`

#### `gram import <source>` — Nouvelle commande

- **`services/importer.ts`** — `importJsonLd(source)` → `ImportResult` :
  - Source : fichier local `.json` ou URL HTTP(S) (détection auto)
  - Extraction du bloc `<script type="application/ld+json">` dans le HTML via regex
  - Support `@type: "Recipe"` direct et `@graph` nested
  - `parseIsoDuration()` : ISO 8601 (PT1H30M) → minutes
  - `flattenInstructions()` : gère `HowToStep` et `HowToSection`
  - `parseIngredient()` : regex avec unités (g, ml, kg, tbsp, cup…), fallback qty-only, fallback nom seul. Guards `?? ''` sur tous les groupes de capture
  - Génération du `.gram` avec frontmatter YAML (title, servings, times), section ingrédients, section étapes
- **`ui/importer.ts`** — `renderImportResult()` : tableau title/ingrédients/étapes + liste des lignes non parsables
- **`commands/import.ts`** — Sortie duale : `--output <file>` écrit le fichier ; sans option, le `.gram` va sur stdout et le résumé sur stderr (pipe-safe)

#### `gram db enrich` — Nouvelle commande

- **`services/db-enricher.ts`** — `enrichDb(db, config, ai, opts)` → `EnrichResult` :
  - Filtre les ingrédients incomplets (density / nutrition / all via `--field`)
  - Batches de 8 ingrédients, concurrence `pLimit(5)`
  - Gemini : `responseMimeType: 'application/json'` + `responseSchema` structuré (density, unit_weight, nutrition étendue, aisle, tagSuggestions)
  - Aisle : enum 11 valeurs (`'Fruits & Légumes'`…`'Autre'`), non-required dans le schéma Gemini — Zod `.default('Autre')` protège contre l'omission
  - Validation Zod par batch — un batch entier échoue gracieusement sans faire planter les autres
  - `tagSuggestions` : `Array.from(new Set([aisle, ...tags].filter(Boolean)))` — l'aisle est toujours le premier tag
  - Écriture YAML AST (pas de re-sérialisation) : `physical`, `nutrition`, `tags` (non-écrasés si déjà renseignés)
  - `onBatchDone(done, total, enriched[], failed[])` : callback de progression
- **`ui/db-enrich.ts`** — `renderEnrichResult()` : liste ✓/✗ par ingrédient avec density et kcal
- **`commands/db/enrich.ts`** — Spinner `@clack/prompts` avec message mis à jour par batch (`Batch N/Total — ✓ M ✗ K`). Args : `--ingredient`, `--field`, `--dry-run`, `--db`
- **`commands/db/index.ts`** — Enregistrement de `enrich`

#### Schéma nutrition étendu (`@gram/analyzer/src/schemas.ts`)

Les champs `sugar`, `sat_fat`, `fiber`, `sodium` (existants) et `unit_weight` dans `physical` (déjà présent) sont désormais peuplés par `gram db enrich`. Le schéma Zod de `IngredientDataSchema` couvre également `mono_fat`, `poly_fat`, `alcohol`.

#### Nouveaux types (`types.ts`)

- `ImportResult` — `{ gramContent, title, ingredientCount, stepCount, parseWarnings }`
- `EnrichEntry` — `{ id, name, density?, unit_weight?, nutrition?, tagSuggestions }`
- `EnrichResult` — `{ dbPath, totalIncomplete, enriched, skipped, failed }`
- `EnrichOptions` — `{ ingredient?, field?, dryRun?, dbPathOverride?, onBatchDone? }`

### Changed

- **`GramConfig`** — Ajout du bloc `ai?: { provider?, apiKey?, model? }` utilisé par `loadAiClient`
- **`src/index.ts`** — Enregistrement de `view`, `import`, `shop` comme subcommandes citty

---

## [Phase 2 — Base de données & Liste de courses] — 2026-06-20

### Added

#### `gram db sync [pattern]` — Nouvelle commande

- **`services/db-sync.ts`** — Collecte tous les IDs d'ingrédients depuis les `shopping_list[]` compilées (`skipAnalyzer: true`, `pLimit(20)`). Déduplique par ID. Compare contre la DB existante. Génère des stubs YAML `{ name, aliases: [], tags: [] }` pour les ingrédients absents. Triage alphabétique des nodes + espacement YAML entre entrées. Crée le dossier `.gram/` si absent
- **`ui/db-sync.ts`** — `renderSyncResult()` : résumé déjà-en-DB / nouveaux, liste `+` par nouvel ID, chemin relatif, hint `gram db enrich`
- **`commands/db/sync.ts`** — Args : `--dry-run` / `-n`, `--db`
- **`commands/db/index.ts`** *(nouveau)* — Commande parente `gram db` avec lazy loading des subcommandes `sync`, `validate`, `enrich`, `lint`

#### `gram db validate` — Nouvelle commande

- **`services/db-validator.ts`** — `validateDb(db, dbPath)` → `DbValidateResult`. Trois catégories de checks :
  - **Schema** : Zod via `validateIngredientDatabase()` (erreurs bloquantes)
  - **Coherence** : aliases dupliqués entre ingrédients différents, `calories > 900 kcal/100g`, `density > 2.5 g/ml`, valeurs négatives (`fat`, `protein`, `carbs`)
  - **Completeness** : density absente (warn), nutrition absente (warn)
- **`ui/db-validate.ts`** — `renderValidateResult()` : issues groupées par catégorie, icônes ✗/⚠, compteurs erreurs/warnings, hint `gram db enrich` si warnings de complétude
- **`commands/db/validate.ts`** — `--strict` : exit 1 sur warnings (CI), `--db` override

#### `gram shop [pattern]` — Nouvelle commande

- **`services/shopper.ts`** — `buildShoppingList(files, opts)` → `ShopResult` :
  - Avec DB : agrège en grammes via `normalizedMass` (densité × volume). Sans DB : agrège par unité si homogène
  - Gestion des `cannotAggregate` (unités mixtes) avec avertissement explicite
  - Catégorisation via `tags[0]`, ordre prédéfini (`Dairy → Meat → Fish → Produce → Grains → Fat → Spice → Other`)
  - Skip des alternatives et des quantités variables (`variable_entries`)
- **`ui/shop.ts`** — `renderShopTerminal()`, `renderShopMarkdown()` (checklist `- [ ]`), `renderShopJson()`. Catégories masquées si toutes `Other`
- **`commands/shop.ts`** — `--format terminal|md|json`, `--output <file>`, `--skip-db`, `--db`

#### `gram init` — Génération de `.gitignore`

- Le `.gram/.gitignore` est généré à l'initialisation pour exclure les fichiers temporaires de build

#### Nouveaux types (`types.ts`)

- `DbSyncOptions` — `{ dryRun?, dbPathOverride? }`
- `DbSyncResult` — `{ dbPath, totalFound, newIngredients, existingIngredients }`
- `DbIssue` — `{ level, category, ingredient?, message }`
- `DbValidateResult` — `{ dbPath, ingredientCount, issues, hasErrors }`
- `ShoppingEntry` — `{ id, name, displayQty, isEstimate, recipes, category, cannotAggregate }`
- `ShopResult` — `{ items, byCategory: Map<string, ShoppingEntry[]>, warnings, recipeCount }`

### Changed

- **`src/index.ts`** — Enregistrement de `db` et `shop` comme subcommandes citty

---

## [0.10.1] — 2026-06-20

Initial release of the CLI. Version synchronized with the rest of the monorepo.

### Added

#### Infrastructure (Steps 0–1)

- **`src/errors.ts`** — Error hierarchy: `GramCLIError`, `GramConfigError`, `GramParseError` + `ExitCode` constant (`Ok`, `Error`, `InternalError`)
- **`src/types.ts`** — Shared interfaces: `GramConfig`, `Diagnostic`, `CheckResult`, `BuildResult`, `PipelineOptions`, `CheckOptions`, `BuildOptions`, `RecipeViewModel`
- **`src/index.ts`** — citty entry point with lazy subcommand loading + global error handler. Version read from `package.json` at build time (never hardcoded)
- **`src/core/config.ts`** — Two-level config loading via `defu`: `~/.config/gram/config.yaml` (global) merged with `.gram/config.yaml` (project). `GEMINI_API_KEY` always takes priority over config files
- **`src/core/db.ts`** — Loads `.gram/ingredients.yaml`, Zod validation via `validateIngredientDatabase`. Supports both formats: with or without top-level `ingredients:` wrapper. Returns `null` if the file is absent (not an error)
- **`src/core/glob.ts`** — Pattern resolution via `Bun.Glob` (marked `external` in tsup), filters `.gram` files, deduplicates with `Set`
- **`src/core/pipeline.ts`** — Shared pipeline `getAST → compile → analyze`. Analyzer is optional depending on the presence of `db`

#### Commands (Steps 2–4)

- **`gram init`** — Initializes `.gram/` in the current directory. Creates `config.yaml` and an `ingredients.yaml` template with a complete example (`butter`). Detects existing initialization and asks for confirmation before overwriting
- **`gram check [pattern]`** — Validates `.gram` files. Defaults to `**/*.gram` glob if no pattern is provided. Collects hard errors (parser/compiler) AND warnings: undefined references (`compiled.warnings`) and ingredients absent from the DB (`analyzed.missingIngredients`). Concurrency via `p-limit(20)`. Exit 0 for warnings only, exit 1 for errors
- **`gram build [pattern]`** — Compiles recipes to JSON. Two modes: stdout (pure JSON, pipe-friendly) and file (`--output <dir>` with full clack UX). `--pretty` flag for indented output. Concurrency via `p-limit(20)`, fail-fast

#### UI

- **`src/ui/diagnostics.ts`** — `renderCheckResult`: output grouped by file, relative paths (`path.relative`), icons per severity level (✗ error / ⚠ warning), `log.error` vs `log.warn` depending on severity

### Technical decisions

- **Framework**: citty (UnJS, TypeScript-first, lazy subcommand loading)
- **UX**: `@clack/prompts` + chalk
- **Config**: YAML via the `yaml` package, merged via `defu`
- **Concurrency**: `p-limit(20)` in services
- **Types**: `@types/bun` in devDependencies (covers both Bun and Node APIs). No `.ts` extensions in imports
- **Build**: tsup + `external: ['bun']` (Bun.Glob is a runtime built-in)
- **Version**: imported from `package.json` at build time

### Fixed

- Default DB path: `db.yaml` → `ingredients.yaml` (aligned with language-server and documentation)
- `ingredients:` wrapper made optional in `core/db.ts` (consistency with `ingredient-loader.ts` in the language-server)
- Absolute paths in diagnostics → relative paths via `path.relative(process.cwd(), file)`
- Version `0.1.0` → `0.10.1` (monorepo synchronization)
- v1 blind spot: warnings silently ignored in `gram check` → now surfaces `compiled.warnings` and `analyzed.missingIngredients`

### Out of scope (deferred)

- `gram render` — Markdown/HTML conversion via `@gram/renderer`
- `gram search` — fuzzy search across recipes
- `gram ai` — nutritional suggestions, ingredient substitutions
- `--manifest` in `gram build` — generate an `index.json` aggregating recipe metadata
- Parser error humanization (raw Ohm.js messages → user-friendly "cooking" messages)
- `kcal` vs `calories` in the Zod schema (breaking change, separate issue)

---

## [Audit structurel — Robustesse & UX] — 2026-06-21

Corrections issues d'un audit de 5 points : résolution de workspace, race conditions, compatibilité Windows, i18n des nombres, et performances à l'échelle.

### Added

#### Nouveau : `core/workspace.ts`

- **`findProjectRoot(start?)`** — Remontée ascendante du système de fichiers depuis `start` (défaut : `process.cwd()`). Cherche un répertoire `.gram/` en appelant `access()` à chaque niveau. S'arrête à la racine du FS et retourne `start` comme fallback gracieux (jamais d'erreur). Algorithme : boucle `while(true)` + `dirname()` jusqu'à `parent === dir`. Zéro dépendance externe.

#### Nouveau : `core/lock.ts`

- **`withFileLock<T>(targetPath, fn)`** — Acquiert un lockfile exclusif (`targetPath + '.lock'`) via `open(lockPath, 'wx')` (flag `O_EXCL` : atomique, échoue si le fichier existe déjà). Exécute `fn()` en section critique, supprime le lock dans le `finally`. Lève une `Error` explicite si le lock est déjà tenu, permettant aux scripts CI de détecter et retenter proprement.
- **`atomicWrite(targetPath, content)`** — Écrit le contenu dans `targetPath + '.tmp'` puis appelle `rename()`. Le rename est atomique sur POSIX (POSIX.1) et sur NTFS (opération indivisible). Élimine le risque de fichier partiellement écrit en cas de crash entre l'écriture et la fin de flush.

#### Nouveau : `core/format.ts`

- **`fmtNumber(n, maxDecimals?)`** — Formate un nombre selon la locale système (`Intl.DateTimeFormat().resolvedOptions().locale`), via `Intl.NumberFormat`. Produit `1,5 kg` sur une locale `fr-FR`, `1.5 kg` sur `en-US`. Seul point d'entrée pour tout affichage de quantité ou valeur nutritionnelle dans le terminal. Ne touche pas aux sorties JSON/YAML (qui restent en notation invariante).

### Changed

#### `types.ts`

- **`GramConfig`** — Ajout du champ `projectRoot: string`. Ce champ est dérivé à l'exécution (non lu depuis les fichiers YAML) et peuplé par `loadConfig()`. Il sert de base absolue pour la résolution de tous les chemins relatifs dans les services.

#### `core/config.ts`

- **`loadConfig()`** — Appelle désormais `findProjectRoot()` en premier. Charge la config projet depuis `join(projectRoot, '.gram', 'config.yaml')` au lieu de `join(process.cwd(), '.gram', 'config.yaml')`. Injecte `projectRoot` dans l'objet retourné. Re-exporte `findProjectRoot` depuis `./workspace` pour les consommateurs qui ont besoin de la racine sans passer par la config complète.

#### `core/glob.ts`

- **`resolveGlob(patterns)`** — Devient `async`. Appelle `findProjectRoot()` pour obtenir le répertoire de scan. Le glob `**/*.gram` part désormais toujours de la racine du projet, quel que soit le répertoire courant de l'utilisateur. Un appel depuis `src/recipes/italian/` trouve les recettes de tout le projet, pas seulement du sous-dossier. La signature reste compatible (même retour `string[]`).

#### `core/db.ts`

- **`resolveDbPath(config, overridePath?)`** *(helper interne)* — Logique de résolution en trois niveaux de priorité : (1) `overridePath` → `resolve(overridePath)` relatif à `cwd` ; (2) `config.database` → `resolve(projectRoot, config.database)` ; (3) fallback → `join(projectRoot, '.gram', 'ingredients.yaml')` via `join()` de `node:path` (compatible Windows, pas de slash hardcodé). Ce helper remplace la ligne `resolve(overridePath ?? config.database ?? '.gram/ingredients.yaml')` qui était Unix-only et ignorait le project root.

#### `commands/build.ts`

- **`resolveInputs()`** — `resolveGlob` passé en `await`.
- **`runToFiles()`** — Les `writeFile()` de sortie sont maintenant limités à 20 appels simultanés via `pLimit(20)` (même plafond que les reads). Sans cette limite, 500 recettes déclenchaient 500 `writeFile` concurrents, risquant `EMFILE` (file descriptors épuisés, limite typique : 1024 sur Linux).

#### `commands/check.ts`, `commands/shop.ts`, `commands/db/sync.ts`

- `resolveGlob` passé en `await` dans les trois commandes.

#### `services/db-enricher.ts`

- **`resolveDbPath(config, override?)`** *(helper interne)* — Utilise `config.projectRoot` comme base, avec `join()` pour le chemin de fallback. Remplace la string hardcodée `.gram/ingredients.yaml`.
- Bloc de write (anciennement lignes 189–229) — Entièrement enveloppé dans `withFileLock(dbPath, ...)`. Le `writeFile` final remplacé par `atomicWrite`. Les deux instances concurrentes de `gram db enrich` (ou `enrich` + `sync` simultanément) ne peuvent plus corrompre le fichier par écriture croisée.

#### `services/db-sync.ts`

- **`resolveDbPath(config, override?)`** *(helper interne)* — Même logique que `db-enricher.ts`, centralisée par service pour éviter les imports croisés.
- **`applySync()`** — Bloc read-modify-write enveloppé dans `withFileLock(dbPath, ...)`. `writeFile` remplacé par `atomicWrite`. Même protection que pour `enrich`.

#### `services/shopper.ts`

- **`formatMass(grams)`** — `parseFloat((grams / 1000).toFixed(2))` remplacé par `fmtNumber(grams / 1000)`. `Math.round(grams)` inchangé mais passé à `fmtNumber(n, 0)`.
- **`buildShoppingList()`** — `displayQty` pour l'agrégation par unité homogène : `` `${total} ${unit}` `` remplacé par `` `${fmtNumber(total)} ${unit}` ``. Les quantités comme `2.5 tsp` s'affichent `2,5 c. à café` en locale française.

#### `services/viewer.ts`

- **`formatMass(grams)`** — Même correction que dans `shopper.ts`.
- **`formatQty(item)`** — Trois cas localisés : quantité `number` directe, `qty.value` numérique, et bornes `qty.range.min`/`max`. Les strings textuelles (`TextQuantity`, `qty.text`) passent inchangées — elles représentent des quantités non-numériques comme `"une pincée"`.

#### `ui/viewer.ts`

- **`renderNutrition()`** — Valeurs passées à `fmtNumber` : calories en 0 décimales (`fmtNumber(p.calories, 0)`), macronutriments en 1 décimale (`fmtNumber(p.carbs, 1)`, etc.). Affichage `312,7 kcal` au lieu de `312.7 kcal` sur les locales à virgule décimale.
- **`outputRecipe()`** — Ajout d'un handler `less.on('error', ...)` : si `less` est absent (Windows, containers minimaux), repli immédiat sur `process.stdout.write(content)` et résolution de la Promise. La commande ne crashe plus silencieusement sur les systèmes sans pager Unix.

### Fixed

- **Résolution de workspace** — `gram check`, `gram build`, `gram shop`, `gram db sync` depuis un sous-dossier du projet ne retournaient plus zéro fichier ni une DB vide ; ils remontent maintenant jusqu'au `.gram/` parent.
- **Race condition** — Deux instances de `gram db enrich` ou `gram db sync` lancées simultanément (script CI parallèle, `npm-run-all -p`) ne peuvent plus provoquer de perte de données par écrasement croisé de `ingredients.yaml`.
- **Crash Windows** — `gram view` ne lève plus d'exception non gérée si `less` est absent, et tombe proprement sur l'écriture directe en stdout.
- **Chemins portables** — Le chemin de fallback vers `ingredients.yaml` utilise désormais `join()` de `node:path` dans tous les services au lieu d'une string avec slash Unix.
- **Nombres localisés** — Les quantités et valeurs nutritionnelles affichées dans `gram view` et `gram shop` respectent le séparateur décimal de la locale système (`Intl.NumberFormat`). Les sorties `--format json` et YAML ne sont pas affectées.

<!-- Add new entries above this line -->

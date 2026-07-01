# @gram/cli — Plan d'implémentation

> Document technique de référence pour le développement de `@gram/cli`.
> Les décisions d'idéation et de priorisation des fonctionnalités sont dans `.notes/cli.md`.

---

## Décisions techniques finales

| Sujet | Décision | Raison |
|---|---|---|
| Framework CLI | `citty` | TypeScript-first, déclaratif, ESM natif, UnJS ecosystem |
| UX interactive | `@clack/prompts` | Standard 2025 (Svelte, Astro CLI), spinners propres |
| Couleurs | `chalk` | Coloration fine dans les rendus (gram view) |
| Config/DB | `yaml` | Déjà dans le workspace (`@gram/analyzer`) |
| Glob | `Bun.Glob` | Natif Bun, zéro dépendance externe |
| Config merge | `defu` | Deep merge propre (UnJS, cohérent avec citty) |
| Build | `tsup` sans `--dts` | CLI, pas une lib — pas besoin de déclarations |
| Tests | `bun test` | Cohérent avec le reste du monorepo |

---

## Architecture : 3 couches strictes

Chaque commande traverse trois couches. **Aucune couche n'importe une couche inférieure.**

```
┌─────────────────────────────────────────────────┐
│  commands/   Parse les args CLI, orchestration   │  ← connaît services/ et ui/
├─────────────────────────────────────────────────┤
│  services/   Logique métier pure, sans I/O       │  ← connaît core/ seulement
├─────────────────────────────────────────────────┤
│  ui/         @clack + chalk, affichage seul      │  ← connaît types/ seulement
├─────────────────────────────────────────────────┤
│  core/       Pipeline, config, db, glob          │  ← aucun import interne
└─────────────────────────────────────────────────┘
```

**Règle d'or :** `services/` ne contient jamais `console.log`, `chalk`, ni `@clack`.
`ui/` ne contient jamais de logique métier.

---

## Structure du package

```
packages/cli/
  src/
    index.ts                  ← Entry : crée le programme citty + enregistre les commandes
    
    commands/                 ← CLI layer (thin) : parse args → appelle service → affiche
      check.ts                ← gram check
      view.ts                 ← gram view
      build.ts                ← gram build
      db/
        index.ts              ← gram db (commande parente)
        extract.ts            ← gram db extract    [v2]
        validate.ts           ← gram db validate   [v2]
    
    services/                 ← Logique métier pure, réutilisable par le plugin 11ty
      checker.ts              ← CheckService  → CheckResult
      viewer.ts               ← ViewService   → RecipeViewModel
      builder.ts              ← BuildService  → BuildResult
      db-extractor.ts         ← DbExtractService → ExtractResult   [v2]
    
    ui/                       ← Présentation uniquement
      diagnostics.ts          ← printDiagnostics(result: CheckResult)
      recipe-view.ts          ← printRecipe(model: RecipeViewModel)
      spinner.ts              ← withSpinner(label, fn) wrapper @clack
    
    core/
      pipeline.ts             ← runPipeline() : parse → compile → analyze
      config.ts               ← Chargeur config deux niveaux
      db.ts                   ← Chargeur + validateur db.yaml
      glob.ts                 ← resolveGlob() via Bun.Glob
    
    errors.ts                 ← Classes d'erreur custom
    types.ts                  ← Interfaces partagées

  package.json
  tsconfig.json
  tsup.config.ts
```

---

## Fichiers de configuration du package

### `package.json`

```json
{
  "name": "@gram/cli",
  "version": "0.1.0",
  "description": "CLI for the GRAM recipe language",
  "type": "module",
  "bin": { "gram": "./dist/index.js" },
  "scripts": {
    "build": "tsup",
    "dev": "bun run src/index.ts"
  },
  "dependencies": {
    "@gram/analyzer": "workspace:*",
    "@gram/kitchen": "workspace:*",
    "@gram/parser": "workspace:*",
    "@gram/renderer": "workspace:*",
    "@clack/prompts": "latest",
    "chalk": "^5.4.0",
    "citty": "latest",
    "defu": "latest",
    "p-limit": "latest",
    "yaml": "^2.9.0"
  },
  "devDependencies": {
    "typescript": "^6.0.3",
    "tsup": "^8.5.1"
  }
}
```

### `tsup.config.ts`

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  tsconfig: '../../tsconfig.build.json',
  banner: { js: '#!/usr/bin/env bun' },
  clean: true,
})
```

Le banner `#!/usr/bin/env bun` rend le binaire exécutable directement.

### `tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

---

## Patterns de code par couche

### `index.ts` — entry point

```ts
import { defineCommand, runMain } from 'citty'
import check from './commands/check.ts'
import view from './commands/view.ts'
import build from './commands/build.ts'
import db from './commands/db/index.ts'

const main = defineCommand({
  meta: { name: 'gram', version: '0.1.0', description: 'GRAM recipe CLI' },
  subCommands: { check, view, build, db },
})

runMain(main)
```

Ajouter une commande = 2 lignes. La supprimer = 2 lignes.

### Pattern `index.ts` — global error handler

```ts
import { defineCommand, runMain } from 'citty'
import { log } from '@clack/prompts'
import { GramCLIError, ExitCode } from './errors.ts'
import check from './commands/check.ts'
import view from './commands/view.ts'

const main = defineCommand({
  meta: { name: 'gram', version: '0.1.0', description: 'GRAM recipe CLI' },
  subCommands: { check, view },
})

try {
  await runMain(main)
} catch (err) {
  if (err instanceof GramCLIError) {
    log.error(err.message)
    process.exit(err.exitCode)
  }
  log.error('Erreur interne inattendue.')
  console.error(err)
  process.exit(ExitCode.InternalError)
}
```

### Pattern `commands/`

```ts
// commands/check.ts
import { defineCommand } from 'citty'
import { check } from '../services/checker.ts'
import { printDiagnostics } from '../ui/diagnostics.ts'
import { resolveGlob } from '../core/glob.ts'
import { loadConfig } from '../core/config.ts'
import { loadDb } from '../core/db.ts'

export default defineCommand({
  meta: { name: 'check', description: 'Validate .gram recipe files' },
  args: {
    files:   { type: 'positional', required: true, description: 'Files or globs' },
    quiet:   { type: 'boolean', short: 'q', description: 'Only show errors' },
    format:  { type: 'string', default: 'pretty', description: 'pretty | json' },
    'no-db': { type: 'boolean', description: 'Skip database warnings' },
  },
  async run({ args }) {
    const config = await loadConfig()
    const db = args['no-db'] ? null : await loadDb(config)
    const files = resolveGlob(args.files as string[])

    const result = await check(files, { db })     // service
    printDiagnostics(result, args)                // ui
    process.exit(result.hasErrors ? 1 : 0)
  },
})
```

### Pattern `services/`

```ts
// services/checker.ts — zéro I/O, zéro chalk
import { runPipeline } from '../core/pipeline.ts'
import type { CheckResult, Diagnostic } from '../types.ts'

export async function check(files: string[], opts: CheckOptions): Promise<CheckResult> {
  // Concurrence limitée : évite l'épuisement des descripteurs de fichiers
  // et les pics mémoire sur des collections de 200+ recettes
  const limit = pLimit(20)
  const perFile = await Promise.all(
    files.map(file => limit(async () => {
      try {
        const { compiled } = await runPipeline(file, { db: opts.db })
        return mapWarnings(compiled.warnings, file)
      } catch (err) {
        return [mapError(err, file)]
      }
    }))
  )

  const diagnostics = perFile.flat()
  return {
    diagnostics,
    hasErrors: diagnostics.some(d => d.level === 'error'),
    fileCount: files.length,
  }
}
```

### Pattern `ui/`

```ts
// ui/diagnostics.ts — @clack + chalk, zéro logique métier
import { relative } from 'node:path'
import { log, outro } from '@clack/prompts'
import chalk from 'chalk'
import type { CheckResult } from '../types.ts'

export function printDiagnostics(result: CheckResult, opts: { quiet?: boolean }) {
  for (const diag of result.diagnostics) {
    if (opts.quiet && diag.level !== 'error') continue
    // Chemin relatif au cwd pour un affichage propre (style ESLint)
    const filePath = chalk.dim(relative(process.cwd(), diag.file))
    const prefix   = diag.level === 'error' ? chalk.red('error') : chalk.yellow('warn')
    log.message(`${filePath}  ${prefix}  ${diag.message}`)
  }

  const errorCount = result.diagnostics.filter(d => d.level === 'error').length
  const summary = result.hasErrors
    ? chalk.red(`${errorCount} error(s) found`)
    : chalk.green('All files valid')
  outro(summary)
}
```

### `core/config.ts` — merge deux niveaux avec `defu`

```ts
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'
import { defu } from 'defu'
import type { GramConfig } from '../types.ts'

async function readYaml(path: string): Promise<Partial<GramConfig>> {
  try {
    return parse(await readFile(path, 'utf-8')) ?? {}
  } catch {
    return {}
  }
}

export async function loadConfig(): Promise<GramConfig> {
  const global  = await readYaml(join(homedir(), '.config', 'gram', 'config.yaml'))
  const project = await readYaml(join(process.cwd(), '.gram', 'config.yaml'))
  // defu : les clés de `project` ont priorité, `global` fournit les défauts
  return defu(project, global) as GramConfig
}
```

### `core/pipeline.ts` — la fonction partagée

```ts
import { readFile } from 'node:fs/promises'
import { getAST } from '@gram/parser'
import { compile } from '@gram/kitchen'
import { analyze } from '@gram/analyzer'
import type { IngredientData } from '@gram/analyzer'
import type { AnalysisResult } from '../types.ts'

export interface PipelineOptions {
  db?: Record<string, IngredientData> | null
  skipAnalyzer?: boolean
}

export interface PipelineResult {
  compiled: ReturnType<typeof compile>
  analyzed: AnalysisResult | null
}

export async function runPipeline(filePath: string, opts: PipelineOptions = {}): Promise<PipelineResult> {
  const content = await readFile(filePath, 'utf-8')
  const ast = getAST(content)
  const compiled = compile(ast)
  const analyzed = (!opts.skipAnalyzer && opts.db)
    ? analyze(compiled, opts.db)
    : null
  return { compiled, analyzed }
}
```

### `core/glob.ts`

```ts
import { Glob } from 'bun'
import { resolve } from 'node:path'

export function resolveGlob(patterns: string[]): string[] {
  return patterns.flatMap(p => {
    if (!p.includes('*')) return [resolve(p)]
    return [...new Glob(p).scanSync({ cwd: process.cwd(), absolute: true })]
  })
}
```

### `errors.ts`

```ts
export const ExitCode = { Ok: 0, Error: 1, InternalError: 2 } as const

export class GramCLIError extends Error {
  constructor(message: string, public readonly exitCode = ExitCode.InternalError) {
    super(message)
    this.name = 'GramCLIError'
  }
}

export class GramConfigError extends GramCLIError {
  constructor(message: string) { super(message, ExitCode.InternalError) }
}
```

---

## Roadmap par phases

### Phase 1 — Fondations (`init` + `check` + `build`)

> Pose le pipeline complet et les outils de base. Utile immédiatement pour tout utilisateur,
> quelle que soit son intégration (11ty, autre SSG, app mobile, scripts…).

#### `gram init`

- Crée la structure `.gram/` dans le dossier courant
- Génère `.gram/config.yaml` (template pré-rempli avec commentaires)
- Génère `.gram/db.yaml` (base vide avec un exemple commenté)
- Génère `.gram/.gitignore` (exclut les clés API si stockées localement)
- Si `.gram/` existe déjà : avertissement, pas d'écrasement

Options : `--path <dir>` pour cibler un autre dossier

#### `gram check <files...>`

- Résout les fichiers via glob ou chemin direct
- Passe chacun dans `runPipeline()` avec `p-limit(20)`
- Attrape les erreurs parser et compiler → diagnostics `error`
- Mappe les `warnings` du `CompilationResult` → diagnostics `warning`
- Si db disponible : warning pour les ingrédients absents de la base
- Exit code `1` si erreur, `0` sinon

Options : `--quiet`, `--format pretty|json`, `--skip-db`

#### `gram build <files...>`

- Compile via `runPipeline()` (parser + kitchen + analyzer si db disponible)
- Sans `--output` : stdout JSON (un seul fichier, stdout pur — aucun log parasite)
- Avec `--output <file>` : écrit un JSON indenté
- Avec `--output <dir/>` : un JSON par recette + `index.json` (slug, title, tags, times)
- Utilisable en pipe : `gram build brioche.gram | jq '.shopping_list'`

Options : `--output`, `--no-analyze`, `--db <path>`, `--pretty`

> **Note stdout :** quand la sortie est stdout, tout affichage @clack/chalk est désactivé.
> Seul `stderr` peut recevoir des logs (erreurs fatales uniquement).

---

### Phase 2 — Boucle de valeur (`db sync` + `shop`)

> **Objectif :** Rendre le CLI utile au quotidien pour quelqu'un qui a déjà ses recettes. Phase 1 valide et compile ; Phase 2 **exploite** les données compilées pour peupler la base d'ingrédients et générer les listes de courses.

---

#### 2.1 Structure de fichiers ajoutée

```
src/
  commands/
    db/
      index.ts       ← gram db (commande parente, sous-commandes lazy)
      sync.ts        ← gram db sync
      validate.ts    ← gram db validate
    shop.ts          ← gram shop

  services/
    db-sync.ts       ← logique de synchronisation (pur, sans I/O sauf lecture fichier)
    db-validator.ts  ← logique de validation de la base
    shopper.ts       ← agrégation des listes de courses + conversion d'unités

  ui/
    db-extract.ts    ← rendu du résultat d'extraction
    db-validate.ts   ← rendu des issues de validation (style diagnostics.ts)
    shop.ts          ← rendu de la liste de courses (terminal, markdown, json)
```

Enregistrement dans `src/index.ts` :

```ts
subCommands: {
  init:  () => import('./commands/init').then(m => m.default),
  check: () => import('./commands/check').then(m => m.default),
  build: () => import('./commands/build').then(m => m.default),
  db:    () => import('./commands/db/index').then(m => m.default),   // nouveau
  shop:  () => import('./commands/shop').then(m => m.default),       // nouveau
}
```

---

#### 2.2 `gram db` — commande parente

Fichier : `src/commands/db/index.ts`

```ts
import { defineCommand } from 'citty'

export default defineCommand({
  meta: { name: 'db', description: 'Manage the ingredient database' },
  subCommands: {
    sync:     () => import('./sync').then(m => m.default),
    validate: () => import('./validate').then(m => m.default),
  },
})
```

Seul rôle : router les sous-commandes. Pas de logique propre.

---

#### 2.3 `gram db sync` — synchronisation d'ingrédients

**Intention :** parcourir des recettes `.gram`, identifier tous les slugs d'ingrédients référencés, et ajouter un stub minimal dans `ingredients.yaml` pour chacun qui n'y est pas encore. Permet de peupler la base passivement, depuis ses propres recettes.
**IMPORTANT :** Cette commande ne supprime JAMAIS aucun ingrédient de la base, même s'il n'est plus utilisé par aucune recette. La donnée est conservée précieusement.

##### Args CLI (`commands/db/sync.ts`)

```
gram db sync [pattern]         # défaut : **/*.gram
gram db sync brioche.gram
gram db sync "recipes/**/*.gram"
gram db sync . --dry-run       # affiche ce qui serait ajouté, sans écrire
gram db sync . --db ./ma-base.yaml   # base alternative
```

| Argument | Type | Description |
|---|---|---|
| `pattern` | `positional` (optionnel) | Fichier, chemin ou glob. Défaut : `**/*.gram` |
| `--dry-run` / `-n` | `boolean` | Aperçu sans écriture |
| `--db` | `string` | Chemin de la base (override config) |

##### Service : `services/db-sync.ts`

```ts
export interface DbSyncOptions {
  dbPathOverride?: string | null
  dryRun?: boolean
}

export interface DbSyncResult {
  dbPath: string
  totalFound: number           // nbre d'IDs uniques trouvés dans les recettes
  newIngredients: string[]     // IDs absents de la db → à ajouter (trié alpha)
  existingIngredients: string[] // IDs déjà présents → ignorés
}

export async function syncIngredients(
  files: string[],
  config: GramConfig,
  opts: DbSyncOptions = {},
): Promise<DbSyncResult>
```

**Logique** (sans I/O de chalk) :

1. `runPipeline(file, { skipAnalyzer: true })` pour chaque fichier en parallèle (`p-limit(20)`)  
   → `skipAnalyzer: true` : la DB peut ne pas exister encore, et on n'a besoin que des IDs référencés.
2. Collecter `compiled.shopping_list.map(item => item.id)` → `Set<string>` pour dédoublonner.
3. Déterminer le `dbPath` : `opts.dbPathOverride ?? config.database ?? '.gram/ingredients.yaml'`
4. Charger l'existant : `readFile(dbPath)` brut → `parseDocument(content)` via `yaml` (retourne un document vide si fichier absent).
5. Extraire les clés existantes depuis le nœud `ingredients` du document.
6. `newIds = [...allIds].filter(id => !existingIds.has(id)).sort()`
7. Si `dryRun` : retourner le résultat sans écrire.
8. Si `newIds.length === 0` : retourner le résultat (rien à faire).
9. Sinon : **append via `yaml.Document`** (préserve les commentaires existants) :
   - Accéder au nœud `ingredients` du document (ou le créer si absent)
   - Pour chaque `id` dans `newIds` (trié alpha), ajouter le stub via `ingredientsNode.set(id, stub)`
   - `await writeFile(dbPath, doc.toString())`

**Structure d'un stub** (champs optionnels omis — `validateIngredientDatabase` ne les requiert pas) :

```yaml
levure-seche:
  name: levure-seche    # slug tel qu'utilisé dans les recettes — à corriger si besoin
  aliases: []
  tags: []
```

Les champs `physical` et `nutrition` sont intentionnellement absents : le schéma Zod les accepte comme optionnels, et `gram db validate` les signalera comme incomplets pour guider l'utilisateur.

> **Préservation des commentaires :** L'API `yaml.Document` + `doc.toString()` préserve les commentaires existants du fichier. Les stubs ajoutés apparaissent à la fin du bloc `ingredients:`, dans l'ordre alphabétique de leur lot (après les entrées existantes).

> **Fichier absent :** si `ingredients.yaml` n'existe pas encore, le document est créé ex-nihilo.

##### UI : `ui/db-sync.ts`

```ts
export function renderSyncResult(result: DbSyncResult, dryRun: boolean): void
```

Sortie terminale :

```
Scanning 14 recipes…

  12 unique ingredients found
   8 already in database (skipped)
   4 new  →  to be added

  + brioche-dough       "brioche-dough"
  + levure-seche        "levure-seche"
  + miel                "miel"
  + vanille             "vanille"

[dry-run] No changes written.          ← si --dry-run
           ou
Updated .gram/ingredients.yaml         ← si écriture effective
→ Run `gram db enrich` to fill in density and nutrition data.
```

Si aucun nouvel ingrédient : `✓ Database up to date (12 ingredients, nothing to add).`

---

#### 2.4 `gram db validate` — validation de la base

**Intention :** détecter les problèmes dans `ingredients.yaml` avant qu'ils ne cassent `gram shop` (densité manquante) ou faussent les calculs nutritionnels (valeurs aberrantes).

##### Args CLI (`commands/db/validate.ts`)

```
gram db validate                  # base de config (default .gram/ingredients.yaml)
gram db validate --strict         # warnings → errors (exit 1 si moindre problème)
gram db validate --db ./autre.yaml
```

| Argument | Type | Description |
|---|---|---|
| `--strict` | `boolean` | Traite les warnings comme des errors (exit code 1) |
| `--db` | `string` | Chemin de la base (override config) |

##### Service : `services/db-validator.ts`

```ts
export interface DbIssue {
  level: 'error' | 'warning'
  category: 'Schema' | 'Completeness' | 'Coherence'
  ingredient?: string   // slug
  message: string
}

export interface DbValidateResult {
  dbPath: string
  ingredientCount: number
  issues: DbIssue[]
  hasErrors: boolean
}

export function validateDb(
  db: Record<string, IngredientData>,
  dbPath: string,
): DbValidateResult
```

**Vérifications** (dans l'ordre d'affichage) :

| # | Catégorie | Niveau | Condition | Message |
|---|---|---|---|---|
| 1 | Coherence | error | Alias apparaît dans ≥ 2 ingrédients différents | `"sugar" is an alias for both white-sugar and brown-sugar` |
| 2 | Completeness | warning | `!ingredient.physical?.density` | `Missing density — volume→mass conversion will fail` |
| 3 | Completeness | warning | `!ingredient.nutrition` | `No nutrition data` |
| 4 | Coherence | warning | `calories > 900` | `Unusually high calorie density (${val} kcal/100g) — verify` |
| 5 | Coherence | warning | `(density ?? 0) > 2.5` | `Unusually high density (${val} g/ml) — verify` |
| 6 | Coherence | error | `fat < 0 \|\| protein < 0 \|\| carbs < 0` | `Negative nutrition value` |

La Zod validation de `core/db.ts` est déjà effectuée avant l'appel au service (le chargement via `loadDb` valide le schéma). Le service travaille donc sur une DB typée correctement — les vérifications ici sont des règles métier, pas de type.

##### UI : `ui/db-validate.ts`

Style calqué sur `ui/diagnostics.ts`, mais pour les issues de DB. Groupé par catégorie.

Sortie terminale :

```
Validating .gram/ingredients.yaml — 24 ingredients

  [Coherence]
  ✗ white-sugar    "sugar" is an alias for both white-sugar and brown-sugar

  [Completeness]
  ⚠ levure-seche   Missing density — volume→mass conversion will fail
  ⚠ miel           Missing density — volume→mass conversion will fail
  ⚠ vanille        No nutrition data

1 error, 3 warnings.
→ Run `gram db enrich` to fill in missing data automatically.
```

Si aucun problème : `✓ Database valid — 24 ingredients, no issues found.`

Exit codes : `0` si OK ou warnings seulement, `1` si errors (ou `--strict` + warnings).

---

#### 2.5 `gram shop` — liste de courses

**Intention :** la "killer feature" de Phase 2. Prendre une ou plusieurs recettes, consolider les quantités du même ingrédient sur plusieurs recettes, et produire une liste de courses lisible (terminal, markdown, ou JSON).

##### Args CLI (`commands/shop.ts`)

```
gram shop brioche.gram
gram shop lundi.gram mardi.gram vendredi.gram
gram shop "this-week/**/*.gram"
gram shop . --format md
gram shop . --format json
gram shop . --output ./courses.md       # écrire dans un fichier
gram shop . --skip-db                     # skip résolution des noms depuis la base
gram shop . --db ./autre.yaml
```

| Argument | Type | Description |
|---|---|---|
| `pattern` | `positional` (optionnel) | Fichier, glob. Défaut : `**/*.gram` |
| `--format` | `string` | `terminal` (défaut) · `md` · `json` |
| `--output` / `-o` | `string` | Fichier de sortie (sinon stdout pour md/json) |
| `--db` | `string` | Chemin de la base (override config) |
| `--skip-db` | `boolean` | Ne pas charger la base (pas de résolution de noms, pas de catégories) |

##### Types partagés (à ajouter dans `types.ts`)

```ts
export interface ShoppingEntry {
  id: string
  name: string           // display name : depuis DB si dispo, sinon id
  totalQty: number       // en unité canonique de base (g ou ml)
  displayQty: string     // formaté lisiblement ("1.2 kg", "300 ml")
  unit?: string          // unité canonique ("g", "ml", ou unité originale si count)
  dimension: 'mass' | 'volume' | 'count' | 'mixed'
  recipes: string[]      // slugs des recettes qui utilisent cet ingrédient
  cannotAggregate: boolean  // true si unités incompatibles et pas de densité dispo
}

export interface ShopResult {
  items: ShoppingEntry[]
  byCategory: Map<string, ShoppingEntry[]>  // vide si pas de DB ou pas de tags
  warnings: string[]         // ex: "miel: cannot aggregate g + ml (no density)"
  recipeCount: number
  ingredientCount: number
}
```

##### Service : `services/shopper.ts`

```ts
export interface ShopOptions {
  db?: Record<string, IngredientData> | null
}

export async function buildShoppingList(
  files: string[],
  opts: ShopOptions = {},
): Promise<ShopResult>
```

**Algorithme** :

**Étape 1 — Collecter les items de toutes les recettes**

Deux branches selon la disponibilité de la DB :

```ts
// Avec DB : on exécute l'analyzer pour obtenir normalizedMass
const { analyzed } = await runPipeline(file, { db: opts.db })
const list = analyzed!.result.shopping_list  // a normalizedMass sur chaque item

// Sans DB : on skip l'analyzer, on travaille sur les quantités brutes
const { compiled } = await runPipeline(file, { skipAnalyzer: true })
const list = compiled.shopping_list
```

Chaque item collecté est augmenté du slug de la recette source.

**Étape 2 — Grouper par `id`**

```ts
const grouped = new Map<string, CollectedItem[]>()
```

**Étape 3 — Agréger les quantités**

| Mode | Source | Logique |
|---|---|---|
| **Avec DB** | `item.normalizedMass` | L'analyzer a déjà converti volume→masse via densité. Sommer `normalizedMass`. Items sans `normalizedMass` (count pur) : sommer `qty` séparément. |
| **Sans DB** | `item.qty` + `item.unit` | Sommer si même unité canonique. Unités différentes → `cannotAggregate: true` + warning. |

L'indicateur `isEstimate: true` de l'analyzer est répercuté sur l'entrée finale (`≈ 250 g` vs `250 g`).

**Étape 4 — Formatter l'affichage des quantités**

```ts
function formatMass(grams: number): string {
  if (grams >= 1000) return `${+(grams / 1000).toFixed(2).replace(/\.?0+$/, '')} kg`
  return `${Math.round(grams)} g`
}
```

Volume : non utilisé en mode "avec DB" (tout est en masse). Utilisé seulement sans DB, quand les unités d'origine sont des volumes identiques.

**Étape 5 — Résoudre les noms et catégories depuis la DB**

Si `opts.db` est fourni :
- `displayName = db[id]?.name ?? id`
- `category = db[id]?.tags?.[0] ?? 'Other'` (premier tag = catégorie principale)

**Étape 6 — Trier et grouper**

- Tri global : par `name` alphabétique
- Si DB avec tags : grouper par catégorie, puis alpha dans chaque catégorie
- Catégories suggérées (selon les tags de la DB) : Dairy · Meat · Fish · Produce · Grains & Flour · Fat · Spice · Other

##### UI : `ui/shop.ts`

**Mode terminal (défaut)** :

```
Shopping list — 3 recipes

  Dairy
    Butter          200 g
    Eggs            6
    Milk            750 ml

  Grains & Flour
    Flour T45       1.2 kg
    Sugar           300 g

  Spice
    Salt            5 g
    Vanilla         2 tsp

  ⚠ miel: found in g (brioche) and ml (cake) — listed separately, no density in database
    miel (brioche)  200 g
    miel (cake)     3 tbsp

─────────────────────────────
12 ingredients · 3 recipes
→ Run `gram db validate` to check for missing density data.
```

**Mode markdown (`--format md`)** :

```markdown
## Shopping list

### Dairy
- [ ] Butter — 200 g
- [ ] Eggs — 6
- [ ] Milk — 750 ml

### Grains & Flour
- [ ] Flour T45 — 1.2 kg
- [ ] Sugar — 300 g

### Spice
- [ ] Salt — 5 g
- [ ] Vanilla — 2 tsp
```

**Mode JSON (`--format json`, stdout pur)** :

```json
{
  "recipes": ["brioche", "quiche", "pasta"],
  "items": [
    { "id": "butter", "name": "Butter", "qty": 200, "unit": "g", "category": "dairy" },
    { "id": "eggs", "name": "Eggs", "qty": 6, "category": "dairy" },
    ...
  ],
  "warnings": []
}
```

Pureté stdout : comme `gram build`, si `--format json` sans `--output`, tout le log va sur stderr.

---

#### 2.6 Nouvelles entrées dans `types.ts`

À ajouter aux types existants :

```ts
// Phase 2 — db extract
export interface ExtractResult {
  dbPath: string
  totalFound: number
  newIngredients: string[]
  existingIngredients: string[]
}

// Phase 2 — db validate
export interface DbIssue {
  level: 'error' | 'warning'
  category: 'Schema' | 'Completeness' | 'Coherence'
  ingredient?: string
  message: string
}

export interface DbValidateResult {
  dbPath: string
  ingredientCount: number
  issues: DbIssue[]
  hasErrors: boolean
}

// Phase 2 — shop
export interface ShoppingEntry {
  id: string
  name: string
  totalQty: number
  displayQty: string
  unit?: string
  dimension: 'mass' | 'volume' | 'count' | 'mixed'
  recipes: string[]
  cannotAggregate: boolean
}

export interface ShopResult {
  items: ShoppingEntry[]
  byCategory: Map<string, ShoppingEntry[]>
  warnings: string[]
  recipeCount: number
  ingredientCount: number
}

export interface ShopOptions {
  db?: Record<string, IngredientData> | null
}
```

---

#### 2.7 Ordre d'implémentation (Phase 2)

```
Étape 6  gram db (commande parente)
         commands/db/index.ts
         → Enregistrer dans index.ts

Étape 7  gram db extract
         services/db-extractor.ts · ui/db-extract.ts · commands/db/extract.ts
         → Test : gram db extract "recipes/**/*.gram" --dry-run

Étape 8  gram db validate
         services/db-validator.ts · ui/db-validate.ts · commands/db/validate.ts
         → Test : gram db validate --strict

Étape 9  gram shop
         services/shopper.ts · ui/shop.ts · commands/shop.ts
         → Test : gram shop "this-week/**/*.gram" --format md
```

Chaque étape doit être fonctionnelle et testée sur des recettes réelles avant de passer à la suivante.

---

#### 2.8 Points de décision à confirmer avant implémentation

| # | Question | Décision finale | Impact |
|---|---|---|---|
| 1 | `gram db sync` : réécriture complète du YAML (perd les commentaires) ou append-only ? | **Append-only via AST YAML**. On utilise le package `yaml` (`Document`) pour préserver les commentaires de l'utilisateur tout en ajoutant les clés à la fin. | Choix de `services/db-sync.ts` |
| 2 | `gram shop` : que faire quand un ingrédient est en g dans une recette et ml dans une autre, sans densité ? | **Lister séparément** avec un warning, ne pas bloquer. Ex: "200ml Lait" et "50g Lait". | Logique d'agrégation dans `services/shopper.ts` |
| 3 | `gram shop --format md` sans `--output` : stdout ou stderr ? | **stdout** (format de sortie intentionnel), tous les logs (spinners) désactivés ou sur stderr. Cohérent avec `gram build`. | Pureté stdout dans `commands/shop.ts` |
| 4 | Nom de la catégorie pour les ingrédients sans tag DB ? | **`"Other"`** (anglais, cohérent avec le CLI). | `ui/shop.ts` |
| 5 | `gram db sync` écrase-t-il les valeurs null si l'utilisateur a rempli la DB entre deux runs ? | **Non** — les clés existantes sont **toujours ignorées**. La synchro ne touche jamais une entrée existante. | Logique de merge dans `services/db-sync.ts` |

---

### Phase 3 — Confort (`view` + `import` + `db enrich`)

> **Objectif :** Transformer le CLI d'outil de gestion en outil de cuisine quotidien. Phase 2 construit et valide les données ; Phase 3 **les rend lisibles et les enrichit** — on peut consulter une recette sans ouvrir un navigateur, importer une recette depuis le web, et laisser l'IA compléter la base d'ingrédients.

---

#### 3.1 Structure de fichiers ajoutée

```
src/
  commands/
    view.ts              ← gram view
    import.ts            ← gram import (--jsonld + extraction HTML)
    db/
      enrich.ts          ← gram db enrich (nouveau sous-cmd, ajouté à db/index.ts)

  services/
    viewer.ts            ← buildViewModel() → RecipeViewModel
    importer.ts          ← importJsonLd() → ImportResult
    db-enricher.ts       ← enrichDb() → EnrichResult

  ui/
    viewer.ts            ← renderRecipe() — chalk terminal + pager
    importer.ts          ← renderImportResult() + renderGramPreview()
    db-enrich.ts         ← renderEnrichResult()

  core/
    ai.ts                ← loadAiClient(config) → GoogleGenerativeAI
```

Enregistrement dans `src/index.ts` : `view` et `import` en lazy import identique aux autres.
`enrich` est enregistré dans `commands/db/index.ts` comme troisième sous-commande.

---

#### 3.2 `gram view` — visionneuse terminal

**Intention :** afficher une recette `.gram` dans le terminal avec toutes les informations utiles — titre, timing, liste de courses, instructions — sans ouvrir un navigateur ni un fichier JSON. Remplace `cat` pour les recettes.

##### Args CLI (`commands/view.ts`)

```
gram view brioche.gram
gram view brioche.gram --db .gram/ingredients.yaml    # avec résolution des noms + nutrition
gram view brioche.gram --no-pager                     # force affichage direct sans less
```

| Argument | Type | Description |
|---|---|---|
| `file` | `positional` (requis) | Chemin vers un fichier `.gram` |
| `--db` | `string` | Base d'ingrédients (override config) — active nutrition si renseignée |
| `--skip-db` | `boolean` | Ignore la DB même si configurée |
| `--no-pager` | `boolean` | Désactive le pager `less` même si la recette est longue |

##### Service : `services/viewer.ts`

```ts
export interface RecipeViewModel {
  title: string
  servings: number | null
  times: { active?: number; prep?: number; rest?: number; total?: number } | null
  shoppingList: Array<{ name: string; displayQty: string; isEstimate: boolean }>
  sections: Array<{
    title: string | null
    ingredients: Array<{ name: string; displayQty: string; isEstimate: boolean }>
    steps: Array<{ action?: string; text: string; timerMinutes?: number }>
  }>
  nutrition: NutritionMetrics | null
  missingIngredients: string[]
}

export async function buildViewModel(
  file: string,
  opts: { db?: Record<string, IngredientData> | null },
): Promise<RecipeViewModel>
```

**Logique :**

1. `runPipeline(file, { db: opts.db })` — avec DB si disponible.
2. Mapper `compiled.meta` → `title`, `servings`, `times`.
3. Liste de courses :
   - Avec DB : utiliser `analyzed.result.shopping_list[]` → `normalizedMass` → `formatMass()` (réutiliser `shopper.ts`)
   - Sans DB : utiliser `compiled.shopping_list[]` → `qty + unit` bruts
   - Filtrer `type: 'alternative'` et `variable_entries` (même logique que `shopper.ts`)
4. Sections/steps : mapper `compiled.sections[]` → extraire les ingrédients de la section, puis `steps[]` → extraire `action`, `text`, timers.
5. Nutrition : `analyzed?.result.metrics.nutrition ?? null`
6. `missingIngredients` : `analyzed?.missingIngredients ?? []`

##### UI : `ui/viewer.ts`

Sortie terminale (chalk) :

```
┌─ Basquaise Chicken & Pilaf Rice ────────────── 4 servings ─┐
│  ⏱  Active: 25min  ·  Cook: 55min  ·  Total: 1h20       │
└─────────────────────────────────────────────────────────────┘

SHOPPING LIST
  chicken thighs     4
  olive oil          2 tbsp
  onion              2
  garlic             3 cloves
  red bell pepper    3
  canned tomatoes    400 g
  basmati rice       200 g
  chicken stock      400 ml

─── Preparation ──────────────────────────────────────────────
  • olive oil          2 tbsp
  • chicken thighs     4

  1. [Heat]    In a dutch oven, warm the olive oil or butter.
  2. [Brown]   The chicken thighs for 10min then set aside.

─── The Piperade ─────────────────────────────────────────────
  • onion              2
  • garlic             3 cloves
  • red bell pepper    3
  • canned tomatoes    400 g

  3. [Sauté]   The onion and garlic until translucent.
  4. [Combine] Add red bell pepper and canned tomatoes.
  5. [Simmer]  Return the chicken and cook for 35min.

─── Pilaf Rice ───────────────────────────────────────────────
  • basmati rice       200 g
  • chicken stock      400 ml

  6. [Toast]   The basmati rice in a bit of oil.
  7. [Add]     The chicken stock.
  8. [Cook]    Cover and simmer (~12min).

⚠ 3 ingredients missing nutrition data — run `gram db enrich`
```

**Pager auto :** si le nombre de lignes de sortie > `process.stdout.rows * 0.85`, piping vers `less -R` via `child_process.spawn`. Désactivable avec `--no-pager` ou si `stdout` n'est pas un TTY (pour la scriptabilité).

> ⚠ **Piège chalk + pager :** quand Node.js pipe vers un processus enfant (`less`), il détecte que stdout n'est plus un TTY et **chalk désactive automatiquement toutes les couleurs**. Il faut forcer `chalk.level = 2` (ou `FORCE_COLOR=1` dans l'environnement du spawn) **avant** de rendre la chaîne formatée, pour que `less -R` reçoive bien les codes ANSI.

**Nutrition (avec DB + données) :**

```
NUTRITION (per serving)
  Calories   342 kcal
  Carbs      48 g
  Protein    9 g
  Fat        12 g
```

Affiché uniquement si `analyzed?.result.metrics.nutrition` est non-null.

---

#### 3.3 `gram db enrich` — enrichissement AI

**Intention :** compléter automatiquement les ingrédients incomplets de la base (sans `density` ou sans `nutrition`) via l'API Gemini, avec validation des résultats avant toute écriture.

##### Args CLI (`commands/db/enrich.ts`)

```
gram db enrich                          # tous les ingrédients incomplets
gram db enrich --ingredient levure-seche    # un seul ingrédient
gram db enrich --field density          # seulement les densités manquantes
gram db enrich --field nutrition        # seulement les données nutritionnelles
gram db enrich --dry-run                # aperçu sans écriture
gram db enrich --db ./autre.yaml
```

| Argument | Type | Description |
|---|---|---|
| `--ingredient` | `string` | Cibler un ingrédient spécifique par slug |
| `--field` | `string` | `density` · `nutrition` · `all` (défaut) |
| `--dry-run` / `-n` | `boolean` | Afficher ce qui serait écrit sans écrire |
| `--db` | `string` | Chemin de la base (override config) |

##### Core : `core/ai.ts`

```ts
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GramCLIError, ExitCode } from '../errors'
import type { GramConfig } from '../types'

export const DEFAULT_AI_MODEL = 'gemini-2.0-flash'

export function loadAiClient(config: GramConfig): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY ?? config.ai?.apiKey
  if (!apiKey) {
    throw new GramCLIError(
      'Gemini API key required. Set GEMINI_API_KEY or run: gram config set ai.apiKey <key>',
      ExitCode.Error,
    )
  }
  return new GoogleGenerativeAI(apiKey)
}
```

Pas de mock, pas de fallback silencieux — l'absence de clé est une erreur explicite avec instruction.

##### Service : `services/db-enricher.ts`

```ts
export interface EnrichEntry {
  id: string
  name: string
  density?: number
  nutrition?: { calories: number; carbs: number; protein: number; fat: number }
  aliasSuggestions: string[]
  tagSuggestions: string[]
}

export interface EnrichResult {
  dbPath: string
  totalIncomplete: number
  enriched: EnrichEntry[]   // données validées + écrites (ou qui seraient écrites)
  skipped: string[]         // ingrédients déjà complets
  failed: string[]          // réponse Gemini invalide pour ces slugs
}

export interface EnrichOptions {
  ingredient?: string
  field?: 'density' | 'nutrition' | 'all'
  dryRun?: boolean
  dbPathOverride?: string
}

export async function enrichDb(
  db: Record<string, IngredientData>,
  config: GramConfig,
  ai: GoogleGenerativeAI,
  opts: EnrichOptions = {},
): Promise<EnrichResult>
```

**Algorithme :**

1. Filtrer les ingrédients à enrichir selon `opts.field` :
   - `density` → `!ing.physical?.density`
   - `nutrition` → `!ing.nutrition`
   - `all` (défaut) → union des deux conditions
   - Si `opts.ingredient` : filtrer à ce seul slug
2. Batch par groupes de **5 à 10 ingrédients maximum** (`p-limit(5)` sur les appels API — prudence concurrence). Groupes plus larges (20+) augmentent le risque que Gemini oublie des entrées dans le tableau retourné ou mélange les alias. L'API étant rapide, la fiabilité du schéma prime sur la taille du batch.
3. **Prompt Gemini (structured output) :**

```ts
const model = ai.getGenerativeModel({
  model: config.ai?.model ?? DEFAULT_AI_MODEL,
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: ENRICH_RESPONSE_SCHEMA,  // Zod → Gemini schema
  },
})
```

Le `responseSchema` Gemini décrit un objet `{ ingredients: [{ key, density?, nutrition?, aliasSuggestions, tagSuggestions }] }`.

**Prompt système :**
```
You are a culinary database assistant. For each ingredient provided, return accurate physical and nutritional data based on standard food science references. Use SI units: density in g/mL, nutrition per 100g of edible portion.
```

4. **Validation Zod de chaque réponse** avant écriture. Si `density > 5` ou `calories > 1000` → considéré invalide → `failed[]`. Jamais d'écriture de données aberrantes.

5. **Écriture via yaml.Document** (même API que `db-sync.ts`) — préserve les commentaires existants. Pour chaque ingrédient enrichi, mettre à jour ses champs `physical.density` et/ou `nutrition` dans le nœud AST.

6. Si `dryRun` : retourner `EnrichResult` sans écrire.

##### UI : `ui/db-enrich.ts`

```
Enriching .gram/ingredients.yaml — 4 incomplete ingredients

  Batch 1/1 (4 ingredients)…

  ✓ levure-seche     density: 0.72 g/mL · 325 kcal/100g
  ✓ miel             density: 1.40 g/mL · 304 kcal/100g
  ✓ vanille          density: 0.58 g/mL · 288 kcal/100g
  ✗ chicken-stock    invalid response — skipped

│
◆  Updated .gram/ingredients.yaml (3 ingredients enriched, 1 failed)
→ Review failed ingredients manually or re-run `gram db enrich --ingredient chicken-stock`
```

Dry-run : remplace la confirmation par `[dry-run] No changes written.`

##### Nouvelle dépendance

```json
"@google/generative-ai": "^0.24.0"
```

Ajoutée dans `packages/cli/package.json` uniquement (feature-gated — pas dans le workspace racine). La commande échoue proprement si la clé API est absente.

---

#### 3.4 `gram import` — import depuis JSON-LD

**Intention :** convertir une recette au format `schema.org/Recipe` (JSON-LD) en fichier `.gram`. Beaucoup de sites exposent leurs recettes en JSON-LD pour le SEO — c'est la méthode d'import la plus fiable, sans scraping fragile.

##### Args CLI (`commands/import.ts`)

```
gram import recipe.json                      # fichier JSON-LD local
gram import recipe.json --output brioche.gram
gram import "https://example.com/recette"    # extraction JSON-LD depuis HTML
gram import "https://example.com/recette" --output brioche.gram
```

| Argument | Type | Description |
|---|---|---|
| `source` | `positional` (requis) | Fichier `.json` local ou URL HTTP(S) |
| `--output` / `-o` | `string` | Fichier de sortie (sinon stdout pur) |

Si `source` commence par `http://` ou `https://` : fetch de la page HTML puis extraction du `<script type="application/ld+json">`. Sinon : lecture du fichier local comme JSON direct.

##### Service : `services/importer.ts`

```ts
export interface ImportResult {
  gramContent: string        // contenu .gram généré
  title: string
  ingredientCount: number
  stepCount: number
  parseWarnings: string[]    // ingrédients non parsables ("une pincée de sel" → @sel{})
}

export async function importJsonLd(source: string): Promise<ImportResult>
```

**Algorithme :**

1. **Résolution de la source :**
   - URL → `fetch(url)` → extraire `<script type="application/ld+json">` via regex → `JSON.parse()`
   - Fichier → `readFile(source)` → `JSON.parse()`
   - Chercher `@type: "Recipe"` (peut être imbriqué dans un `@graph`)

2. **Mapping schema.org → .gram :**

| JSON-LD | .gram |
|---|---|
| `name` | titre dans le frontmatter YAML |
| `recipeYield` | `servings:` dans le frontmatter |
| `prepTime` + `cookTime` | `time:` ISO 8601 → minutes |
| `author.name` | `author:` dans le frontmatter |
| `recipeIngredient[]` | parsés → `@ingredient{qty unit}` |
| `recipeInstructions[]` | steps → `[Action] texte.` sous `## Instructions` |

3. **Parsing des ingrédients** (regex best-effort) :
   - Pattern : `(\d+[\d./]*)\s*(g|ml|kg|L|tbsp|tsp|cup|oz|lb|...)?\s+(.+)`
   - Si parsable → `@slug{qty unit}` avec slug = nom normalisé (lowercase, tirets)
   - Si non parsable → `@slug{}` (sans quantité) + entrée dans `parseWarnings`

4. **Génération du `.gram`** (template string) :

```
---
title: 'Brioche au beurre'
author: 'Maison Kayser'
servings: 8
time:
  prep: 30
  active: 45
  rest: 120
---

## Instructions

[Step 1] Mélanger le @flour{500g} avec le @warm-milk{120ml}.
[Step 2] Ajouter le @butter{200g} en morceaux et pétrir 10 min.
[Step 3] Laisser lever ~{2h} à température ambiante.
```

Les noms d'action (`[Step 1]`, `[Step 2]`...) sont génériques si les instructions JSON-LD n'ont pas de `name`. Le fichier est conçu pour être édité manuellement après import.

##### UI : `ui/importer.ts`

```
Importing schema.org/Recipe from https://example.com/brioche

  Title        Brioche au beurre
  Servings     8
  Ingredients  12  (2 unparsable — see below)
  Steps        6

  ⚠ Could not parse:
    "une pincée de sel fin"  →  @sel-fin{}  (quantity unknown)
    "levure selon la recette"  →  @levure{}  (quantity unknown)

│
◆  Written to brioche.gram
→ Run `gram check brioche.gram` to validate, then edit quantities manually.
```

Sans `--output` : le `.gram` est écrit sur stdout pur, les logs sur stderr.

---

#### 3.5 Nouvelles entrées dans `types.ts`

```ts
// Phase 3 — view
export interface RecipeViewModel {
  title: string
  servings: number | null
  times: { active?: number; prep?: number; rest?: number; total?: number } | null
  shoppingList: Array<{ name: string; displayQty: string; isEstimate: boolean }>
  sections: Array<{
    title: string | null
    steps: Array<{ action?: string; text: string; timerMinutes?: number }>
  }>
  nutrition: NutritionMetrics | null
  missingIngredients: string[]
}

// Phase 3 — import
export interface ImportResult {
  gramContent: string
  title: string
  ingredientCount: number
  stepCount: number
  parseWarnings: string[]
}

// Phase 3 — db enrich
export interface EnrichEntry {
  id: string
  name: string
  density?: number
  nutrition?: { calories: number; carbs: number; protein: number; fat: number }
  aliasSuggestions: string[]
  tagSuggestions: string[]
}

export interface EnrichResult {
  dbPath: string
  totalIncomplete: number
  enriched: EnrichEntry[]
  skipped: string[]
  failed: string[]
}
```

---

#### 3.6 Ordre d'implémentation (Phase 3)

```
Étape 10  gram view
          services/viewer.ts · ui/viewer.ts · commands/view.ts
          → Enregistrer dans index.ts
          → Test : gram view brioche.gram
          → Test : gram view brioche.gram (recette longue → pager auto)
          → Test : gram view brioche.gram --db .gram/ingredients.yaml (avec nutrition)

Étape 11  gram import
          services/importer.ts · ui/importer.ts · commands/import.ts
          → Enregistrer dans index.ts
          → Test : gram import recipe.json --output imported.gram
          → Test : gram import "https://..." --output imported.gram (extraction HTML)
          → Valider avec `gram check imported.gram`

Étape 12  gram db enrich
          core/ai.ts · services/db-enricher.ts · ui/db-enrich.ts · commands/db/enrich.ts
          → Ajouter `enrich` dans commands/db/index.ts
          → Test : gram db enrich --dry-run (sans clé → erreur explicite)
          → Test : gram db enrich --ingredient levure-seche (avec clé)
          → Test : gram db enrich --field density (batch complet)
```

Chaque étape doit être fonctionnelle et testée sur des recettes réelles avant de passer à la suivante.

---

#### 3.7 Points de décision (Phase 3)

| # | Question | Décision | Impact |
|---|---|---|---|
| 1 | `gram view` : pager auto ou opt-in ? | **Auto** si lignes > `stdout.rows * 0.85`. Désactivable avec `--no-pager` ou si stdout n'est pas un TTY. | `ui/viewer.ts` |
| 2 | `gram view` : DB optionnelle ou requise ? | **Optionnelle** — sans DB affiche qtés brutes, avec DB affiche masses normalisées + nutrition si disponible. | `services/viewer.ts` |
| 3 | `gram db enrich` : modèle Gemini par défaut ? | **`gemini-2.0-flash`** — structured JSON output natif, économique. Configurable via `config.ai.model`. | `core/ai.ts` |
| 4 | `gram db enrich` : données aberrantes de Gemini ? | **Validation Zod + seuils** (`density > 5`, `calories > 1000` → rejet). Jamais d'écriture invalide — ingrédient listé dans `failed[]`. | `services/db-enricher.ts` |
| 5 | `gram import` : ingrédients non parsables ("une pincée") ? | **Import quand même** comme `@slug{}` sans quantité + entrée dans `parseWarnings`. Le fichier est éditable après. | `services/importer.ts` |
| 6 | `gram import` : sortie par défaut ? | **stdout pur** (comme `gram build`) si pas de `--output`. Logs sur stderr. | `commands/import.ts` |
| 7 | `gram import` : que faire si la page web ne contient pas de JSON-LD ? | Erreur explicite : `"No schema.org/Recipe JSON-LD found on this page. Try downloading the page and passing the JSON-LD directly."` | `services/importer.ts` |
| 8 | `gram db enrich` : préservation des commentaires DB ? | **yaml.Document API** — même approche que `db-sync.ts` (Phase 2, déjà maîtrisée). | `services/db-enricher.ts` |

---

### Phase 4 — Lifestyle (`plan` + `pantry` + `cost`)

- `gram plan` — planification hebdomadaire avec liste de courses agrégée
- `gram pantry` — gestion des stocks, soustrait du shop
- `gram cost` — estimation du coût par portion

---

## Ordre d'implémentation (Phase 1)

```
Étape 0  Scaffolding
         package.json · tsconfig.json · tsup.config.ts · src/index.ts (entry + error handler)

Étape 1  Core infrastructure
         types.ts · errors.ts
         core/config.ts (defu) · core/db.ts · core/glob.ts (Bun.Glob) · core/pipeline.ts

Étape 2  gram init
         commands/init.ts  (pas de service dédié — I/O pur, logique triviale)

Étape 3  gram check
         services/checker.ts (Promise.all + p-limit) · ui/diagnostics.ts · commands/check.ts

Étape 4  gram build
         services/builder.ts · commands/build.ts
         (stdout pur si pas de --output, @clack désactivé dans ce mode)

Étape 5  Intégration et test end-to-end
         bun link · test sur recettes réelles · ajout dans turbo.json
```

Chaque étape doit être **fonctionnelle et testable** avant de passer à la suivante.

---

## Développement local

```bash
# Lancer sans build (rapide pendant le développement)
bun run packages/cli/src/index.ts check ma-recette.gram

# Rendre disponible globalement comme `gram`
cd packages/cli && bun link

# Build de production
cd packages/cli && bun run build

# Vérifier que le binaire fonctionne
./packages/cli/dist/index.js --version
```

Ajouter au `turbo.json` une fois l'étape 0 terminée :

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"]
    }
  }
}
```

---

## Types partagés (`types.ts`)

```ts
import type { IngredientData } from '@gram/analyzer'

export type DiagnosticLevel = 'error' | 'warning' | 'info'

export interface Diagnostic {
  level: DiagnosticLevel
  file: string
  message: string
  line?: number
  col?: number
}

export interface CheckResult {
  diagnostics: Diagnostic[]
  hasErrors: boolean
  fileCount: number
}

export interface BuildResult {
  slug: string
  data: object
}

export interface GramConfig {
  version?: number
  database?: string
  language?: string
  ai?: { provider: string; apiKey?: string; model?: string }
}

export interface CheckOptions {
  db?: Record<string, IngredientData> | null
}

export interface PipelineOptions {
  db?: Record<string, IngredientData> | null
  skipAnalyzer?: boolean
}
```

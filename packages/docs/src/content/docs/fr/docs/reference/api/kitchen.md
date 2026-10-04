---
title: "@gram-lang/kitchen"
description: "Le compilateur : transforme une recette parsée en un JSON structuré avec liste de courses, minutages et avertissements."
---

Il s'agit du compilateur. Il prend un `RecipeAST` (issu de `@gram-lang/parser`) et génère un `CompilationResult` : un objet JSON propre, structuré, prêt au rendu (liste de courses, instructions découpées par section avec leurs minutages, un registre global d'ingrédients/matériel, et les éventuels *warnings* structurels). Aucune base de données d'ingrédients n'est nécessaire à cette étape : ce sera le rôle de `@gram-lang/analyzer`.

## `compile`

```typescript
function compile(ast: RecipeAST, options?: CompilerOptions): CompilationResult
```

```typescript
import { getAST } from '@gram-lang/parser';
import { compile } from '@gram-lang/kitchen';

const ast = getAST(source);
const compiled = compile(ast);
// compiled.shopping_list, compiled.sections, compiled.metrics, compiled.warnings, ...
```

Cette fonction *throw* une `Error` simple pour toute violation structurelle impossible à représenter via un *warning* récupérable (ex : plus d'un ingrédient marqué avec le modificateur *Baker's Math* `*`).

### `CompilerOptions`

```typescript
interface CompilerOptions {
  scaleFactor?: number; // intègre un multiplicateur fixe dans la sortie compilée
}
```

### `CompilationResult`

```typescript
interface CompilationResult {
  generator: string;                 // "@gram-lang/kitchen@<version>" : le compilateur qui a écrit ce JSON
  title: string | null;
  slug: string | null;
  meta: Meta;                        // frontmatter parsé
  scaleFactor?: number;              // présent une fois un ajustement des proportions appliqué
  registry: {
    ingredients: Record<string, RegistryEntry>;
    cookware: Record<string, { id: string; name: string }>;
  };
  shopping_list: (ShoppingListItem | CompositeItem | Usage)[];
  cookware: Usage[];
  sections: ProcessedSection[];
  warnings: Warning[];
  metrics: {
    preparationTime: number;         // somme des miseEnPlace[].duration (minutes)
    activeTime: number;              // somme du temps de travail actif (minutes)
    // Dépréciés depuis la 1.4.0, retirés en 2.0.0 (voir plus bas) :
    totalTime: number;
    idleTime: number;
    activeBreakdown: TimeBreakdownItem[];
    prepBreakdown: TimeBreakdownItem[];
    totalBreakdown: TimeBreakdownItem[];
  };
  miseEnPlace: SectionMiseEnPlace[]; // ce que coûte la préparation de chaque section
  tasks: TaskGraph;                  // depuis la 1.4.0 : tout ce qu'il y a à faire, et ce que chaque tâche attend
  schedule: Schedule;                // depuis la 1.4.0 : le planning par défaut, posé à partir de `tasks`
}

interface SectionMiseEnPlace {
  section: number;                   // indice dans `sections`
  duration: number;                  // == somme des items[].duration
  items: MiseEnPlaceItem[];
}

type MiseEnPlaceItem =
  | { kind: "gather"; target: "ingredient" | "cookware"; count: number; duration: number; intermediates?: number }
  | { kind: "prepare"; ref: { type: "ingredient" | "cookware"; id: string }; duration: number; intermediate?: true };

interface Schedule {
  totalTime: number;                 // max(end) sur les blocs, à partir de 0
  idleTime: number;                  // totalTime - metrics.activeTime - metrics.preparationTime
  blocks: ScheduleBlock[];           // triés par start, puis par end
  sessions: ScheduleSession[];       // une par journée de travail, jour le plus lointain d'abord
}

interface ScheduleSession {
  day: number;                       // 0 = le jour même, 1 = la veille (~{-1d})...
  start: number;                     // bornes du travail actif de la session
  end: number;
  sections: number[];                // sections travaillées ce jour-là
}

type ScheduleBlock =
  | { kind: "prep"; task: string; section: number; start: number; end: number; deferred?: true; items?: MiseEnPlaceItem[] }
  | { kind: "step"; task: string; section: number; step: number; start: number; end: number }
  | { kind: "passive"; task: string; section: number; step: number; track?: string; start: number; end: number };

// `tasks`, en bref ; les types complets sont dans la référence du scheduler
interface TaskGraph {
  tasks: Task[];                     // tâches `prep`, `step` et `passive`, section par section
  sections: { day: number; deadline?: number; intermediate?: string }[];
}
```

:::note[Nouveau en 1.4.0 : `generator`, `miseEnPlace`, `tasks` et `schedule`]
`miseEnPlace` dit ce que coûte la préparation de chaque section. `tasks` est le **graphe des tâches** : la préparation de chaque section et de chaque intermédiaire qu'elle utilise, chaque étape et chaque minuteur, avec leur durée et ce que chaque tâche attend (voir la [référence du scheduler](/fr/docs/reference/api/scheduler/) pour sa forme complète). `schedule` est le **planning par défaut**, posé à partir de lui par `@gram-lang/scheduler` : la mise en place juste avant chaque section, les repos les plus courts. Il se décrit lui-même (`miseEnPlace`, `rests`), si bien qu'il n'y a jamais à se rappeler avec quelles options il a été fait.

Tout autre planning sort du même graphe, sans recompiler : `layout(compiled.tasks, { miseEnPlace: "upfront" })` (toute la préparation d'abord), `"perSession"` (la préparation de chaque journée de travail rassemblée au début de cette journée) et le choix des `rests` (`"shortest"`, `"balanced"`, `"longest"`). Ne reconstruisez jamais un planning à la main à partir de `miseEnPlace`.

Dans un planning, tous les temps sont en minutes depuis 0 et incluent la préparation. `sessions` liste les journées de travail : elles viennent des ancres des sections **en jours** (`~{-1d}`) ; une ancre en heures n'ouvre jamais de journée, et une recette sans ancre en jours tient en une seule session. Dans un bloc `step` ou `passive`, `step` est l'indice dans `sections[section].steps`, commentaires compris, `track` n'existe que pour un minuteur nommé (`~_four{...}`), et `task` est l'identifiant de la tâche dans `tasks` (`s0.3`, `s0.3.t0` ; un bloc `prep` qui rassemble plusieurs préparations porte l'identifiant de la première). Une section sans préparation n'a ni entrée `miseEnPlace` ni bloc `prep` : `miseEnPlace` n'est donc pas indexé par section, retrouvez une entrée grâce à son champ `section`, jamais à sa position dans le tableau. `intermediates` (sur une ligne `gather`) dit combien des ingrédients rassemblés sont des intermédiaires (`&pâte`), et `intermediate` (sur une ligne `prepare`) que l'ingrédient préparé en est un ; les deux sont absents sinon. Un intermédiaire est fabriqué pendant la recette : le planning `upfront` ne le rassemble donc pas au début, cette part de la préparation d'une section devient un second bloc `prep`, juste avant la section, et une section peut avoir deux blocs `prep` en `upfront` et `perSession` : celui qui est placé plus tard porte `deferred: true`. `items` n'existe sur un bloc `prep` que s'il ne porte qu'une partie de l'entrée de sa section (le reste étant dans l'autre bloc) : sinon, lisez les items de l'entrée.

Un minuteur écrit en fourchette garde sa fourchette dans le graphe (`{ nominal, min, max }`), et le planning prend une fourchette passive sur le chiffre que choisit `rests` (le plus court par défaut) et une fourchette active sur son chiffre le plus long. Les champs dépréciés ci-dessous continuent de compter une fourchette comme sa moyenne.

D'où vient chaque champ, pour savoir ce qu'on peut croire et ce qu'il faut recalculer :

| Champ | Nature | Remarque |
|---|---|---|
| `generator`, `miseEnPlace[].items`, `tasks` | Source | Écrits par le compilateur. |
| `miseEnPlace[].duration` | Dérivé | La somme de ses `items`, gardée pour vous éviter de les additionner. |
| `metrics.preparationTime`, `schedule.preparationTime` | Dérivé | La somme de tous les `miseEnPlace[].duration`. |
| `schedule` | Dérivé | `layout(tasks)`, à l'octet près : le graphe suffit pour le retrouver. |
| `schedule.totalTime` | Dérivé | Le `end` le plus tardif parmi les blocs. |
| `schedule.idleTime` | Dérivé | `totalTime - activeTime - preparationTime`. |

Un lecteur doit ignorer les champs et les valeurs de `kind` qu'il ne connaît pas : de nouveaux peuvent arriver dans une version mineure.
:::

:::caution[Déprécié en 1.4.0, retiré en 2.0.0]
Ces champs gardent les mêmes valeurs et le même sens jusqu'à la 2.0.0, mais il faut lire leur remplaçant :

| Déprécié | À utiliser à la place |
|---|---|
| `steps[].timings` | Les blocs `step` de `schedule.blocks` |
| `steps[].backgroundTasks` | Les blocs `passive` de `schedule.blocks` |
| `metrics.totalTime` | `schedule.totalTime` |
| `metrics.idleTime` | `schedule.idleTime` |
| `metrics.activeTime` | `schedule.activeTime` (un minuteur écrit en fourchette compte pour sa moyenne dans l'ancien champ, et pour son chiffre le plus long dans le planning) |
| `metrics.activeBreakdown`, `metrics.prepBreakdown`, `metrics.totalBreakdown` | `miseEnPlace` et `schedule` |
| `calculatePreparationTime().breakdown` | Les `items` de `computeMiseEnPlace()` (`calculatePreparationTime()` renvoie toujours `total`) |

`metrics.preparationTime` n'est **pas** déprécié : il est identique quel que soit le plan. Attention : l'ancien `metrics.totalTime` est le total avec toutes les préparations d'abord, soit le total de `layout(tasks, { miseEnPlace: "upfront" })` sauf si la recette a des intermédiaires : `upfront` les rassemble une fois qu'ils existent, il peut donc être plus court.

La page [Fonctionnalités dépréciées](/fr/docs/how-to/deprecations) donne un avant/après en code pour chacun d'eux.
:::

:::note[JSON compilé avant la 1.4.0]
Le JSON écrit par kitchen 1.3.0 ou une version antérieure n'a ni `tasks` ni `schedule`. Il s'affiche toujours : `scheduleTimes` lit le temps total et le temps d'attente dans l'ancien `metrics.totalTime` et `metrics.idleTime`, et le diff les compare correctement au lieu de lire zéro. En revanche, il n'y a ni mise en place ni chronologie à dessiner, donc le diagramme de Gantt reste vide. Recompilez la recette avec la 1.4.0 ou plus pour les obtenir. Ce repli disparaîtra avec les champs dépréciés en 2.0.0.
:::

Voir [Formats de données](/fr/docs/reference/api/data-formats) pour un exemple entièrement annoté de cette structure, et [Avertissements](/fr/docs/reference/api/warnings) pour le catalogue de ce qui peut apparaître dans `.warnings`.

## Ajustement des proportions

Les recettes sont d'abord compilées avec leurs quantités par défaut ; l'ajustement des proportions (*scaling*) est une étape séparée et composable. Ainsi, les appelants (ex : un *slider* « portions » temps réel dans une UI) peuvent recalculer les quantités à la volée, sans devoir re-parser ni recompiler.

```typescript
function resolveScaleFactor(
  compiled: CompilationResult | null,
  request: ScaleRequest,
  convertUnit?: UnitConverter,
): ScaleResolution

function applyScale(result: CompilationResult, factor: number): CompilationResult
```

`ScaleRequest` est soit un multiplicateur fixe, soit une quantité cible pour un ingrédient précis de la liste de courses, que `resolveScaleFactor` transforme en un unique `factor` :

```typescript
type ScaleRequest =
  | { type: "factor"; value: number }
  | { type: "target"; id: string; qty: number; unit: string | null };
```

```typescript
import { resolveScaleFactor, applyScale } from '@gram-lang/kitchen';

// « Je veux 300g de farine au total » -> dérive le multiplicateur depuis la liste de courses compilée
const { factor } = resolveScaleFactor(compiled, { type: 'target', id: 'farine', qty: 300, unit: 'g' });
const scaled = applyScale(compiled, factor);
```

`resolveScaleFactor` lève une sous-classe typée de `ScaleError` (chacune avec un `.code`) lorsque la demande ne peut être satisfaite : `InvalidFactorError` (levée si le facteur n'est pas strictement positif fini ou si une quantité dépasse `Infinity`), `IngredientNotFoundError`, `NestedOnlyTargetError` (la cible n'existe que dans une sous-recette composite), `AlternativeTargetError` (la cible est une option d'un groupe `@a|@b`), `FixedIngredientError` (marqué `@=` ou non numérique), `RelativeTargetError` (quantité dérivée d'un `%`), `AmbiguousMultiUnitError` (utilisé avec des unités incompatibles dans la recette), `NonNumericTargetError`, `UnitMismatchError`.

`applyScale` est une fonction pure : elle ne mute jamais son entrée. Le même `CompilationResult` peut donc être *scalé* à de multiples reprises (ex : à chaque mouvement de souris sur un *slider*) sans accumuler de dérives. Elle garantit l'invariant de parité suivant : `applyScale(compile(ast), factor) ≡ compile(ast, { scaleFactor: factor })`.

## Liste de courses & minutage (bas niveau)

`compile()` appelle déjà ces fonctions sous le capot ; elles ne sont exportées que pour des cas d'usage très avancés (ex : regénérer une liste de courses depuis un `ProcessedSection[]` reconstitué de toutes pièces).

```typescript
function generateShoppingList(
  sections: ProcessedSection[],
  registry: Registry,
  options?: CompilerOptions,
): (ShoppingListItem | CompositeItem | Usage)[]

function calculatePreparationTime(
  sections: ProcessedSection[],
  registry: Registry,
  mise?: SectionMiseEnPlace[], // depuis la 1.4.0 : la répartition ci-dessous, si vous l'avez déjà
): { total: number; breakdown: TimeBreakdownItem[] } // `breakdown` est déprécié, voir plus bas

// Depuis la 1.4.0 : la répartition de la mise en place, et les choix d'un planning
function computeMiseEnPlace(sections: ProcessedSection[], registry: Registry): SectionMiseEnPlace[]
// ^ le champ `miseEnPlace` d'une recette compilée, déduit de ses sections

type MiseEnPlaceMode = "perSection" | "upfront" | "perSession"
const MISE_EN_PLACE_MODES: readonly ["perSection", "upfront", "perSession"]
const DEFAULT_MISE_EN_PLACE_MODE: MiseEnPlaceMode // "perSection"
function isMiseEnPlaceMode(value: unknown): value is MiseEnPlaceMode

type RestChoice = "shortest" | "balanced" | "longest"
const REST_CHOICES: readonly ["shortest", "balanced", "longest"]
const DEFAULT_REST_CHOICE: RestChoice // "shortest"
function isRestChoice(value: unknown): value is RestChoice

// Le planning d'un choix : le `schedule` compilé pour le choix par défaut, sinon
// posé à partir de `tasks` (une fois, puis gardé). Undefined pour un JSON sans `tasks`.
function scheduleFor(compiled, mode?: MiseEnPlaceMode, rests?: RestChoice): Schedule | undefined
function scheduleTimes(compiled, mode?: MiseEnPlaceMode, rests?: RestChoice): { totalTime: number; idleTime: number }

// Réexporté depuis @gram-lang/scheduler, pour le code qui ne connaît que la Kitchen
function layout(graph: TaskGraph, options?: LayoutOptions): { schedule: Schedule; diagnostics: SchedulingDiagnostic[] }

// Depuis la 1.4.0 : la plus longue durée que Gram planifie (1000 ans, voir DURATION_OUT_OF_RANGE)
const MAX_DURATION_MINUTES: number // 525_600_000
function quantityToMinutes(qty): number // une quantité de temps ({ value, unit }) en minutes, plafonnée à ±MAX_DURATION_MINUTES depuis la 1.4.0
function isDurationTooLong(qty): boolean // vrai quand la quantité demande plus que MAX_DURATION_MINUTES
function maxDurationIn(unit: string): number // MAX_DURATION_MINUTES exprimé dans `unit` ("min", "h", "d"…)
```

## `RecipeRegistry`

Il s'agit du registre mutable (ingrédients et matériel) instancié pendant la compilation, et indexé par `slugify(name)`. Il implémente l'interface `Registry` (`ingredients: Map`, `cookware: Map`, `warnings: Warning[]`).

```typescript
class RecipeRegistry implements Registry {
  registerIngredient(name: string, data?: Partial<Omit<RegistryEntry, "id" | "name">>): string; // retourne l'id
  registerCookware(name: string): string;                                                        // retourne l'id
  getIngredientId(name: string): string;
  toPlainObject(): { ingredients: Record<string, RegistryEntry>; cookware: Record<string, {...}> };
}
```

`RegistryEntry` porte `id`, `name`, et optionnellement `default_unit`, `is_composite`, `parent` (pour les enfants de sous-recettes composites), et `is_intermediate`.

## Avertissements

`CompilationResult.warnings` est un tableau de `Warning[]` recensant les problèmes structurels détectés pendant la compilation (références fantômes, conflits de portée, unités de minuteur/température invalides, références circulaires...). Consultez la [référence des avertissements](/fr/docs/reference/api/warnings) pour la liste exhaustive des codes, des niveaux de sévérité, et des utilitaires `WarningCode`/`pushWarning`.

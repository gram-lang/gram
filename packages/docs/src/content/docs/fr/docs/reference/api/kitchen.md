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
  schedules: Record<MiseEnPlaceMode, Schedule>; // perSection, upfront, perSession
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
  | { kind: "prep"; section: number; start: number; end: number; deferred?: true; items?: MiseEnPlaceItem[] }
  | { kind: "step"; section: number; step: number; start: number; end: number }
  | { kind: "passive"; section: number; step: number; track?: string; start: number; end: number };
```

:::note[Nouveau en 1.4.0 : `generator`, `miseEnPlace` et `schedules`]
`miseEnPlace` dit ce que coûte la préparation de chaque section, et `schedules` contient trois chronologies complètes construites à partir de là : `perSection` (la préparation de chaque section juste avant elle), `upfront` (toute la préparation d'abord) et `perSession` (la préparation de chaque journée de travail rassemblée au début de cette journée, les jours venant des ancres `~{-Nd}` des sections ; une recette sans ancre de ce genre tient en une seule session, comme `upfront`). `sessions` liste les journées de travail d'une chronologie. Tous les temps sont en minutes depuis 0 et incluent la préparation. Dans un bloc `step` ou `passive`, `step` est l'indice dans `sections[section].steps`, commentaires compris, et `track` n'existe que pour un minuteur nommé (`~_four{...}`). Une section sans préparation n'a ni entrée `miseEnPlace` ni bloc `prep` : `miseEnPlace` n'est donc pas indexé par section, retrouvez une entrée grâce à son champ `section`, jamais à sa position dans le tableau. `intermediates` (sur une ligne `gather`) dit combien des ingrédients rassemblés sont des intermédiaires (`&pâte`), et `intermediate` (sur une ligne `prepare`) que l'ingrédient préparé en est un ; les deux sont absents sinon. Un intermédiaire est fabriqué pendant la recette : le planning `upfront` ne le rassemble donc pas au début, cette part de la préparation d'une section devient un second bloc `prep`, juste avant la section, et une section peut avoir deux blocs `prep` en `upfront` et `perSession` : celui qui est placé plus tard porte `deferred: true`. `items` n'existe sur un bloc `prep` que s'il ne porte qu'une partie de l'entrée de sa section (le reste étant dans l'autre bloc) : sinon, lisez les items de l'entrée.

D'où vient chaque champ, pour savoir ce qu'on peut croire et ce qu'il faut recalculer :

| Champ | Nature | Remarque |
|---|---|---|
| `generator`, `miseEnPlace[].items` | Source | Écrits par le compilateur. |
| `miseEnPlace[].duration` | Dérivé | La somme de ses `items`, gardée pour vous éviter de les additionner. |
| `metrics.preparationTime` | Dérivé | La somme de tous les `miseEnPlace[].duration`. |
| `schedules[mode].totalTime` | Dérivé | Le `end` le plus tardif parmi les blocs. |
| `schedules[mode].idleTime` | Dérivé | `totalTime - metrics.activeTime - metrics.preparationTime`. |

Un lecteur doit ignorer les champs et les valeurs de `kind` qu'il ne connaît pas : de nouveaux peuvent arriver dans une version mineure.
:::

:::caution[Déprécié en 1.4.0, retiré en 2.0.0]
Ces champs gardent les mêmes valeurs et le même sens jusqu'à la 2.0.0, mais il faut lire leur remplaçant :

| Déprécié | À utiliser à la place |
|---|---|
| `steps[].timings` | Les blocs `step` de `schedules[mode].blocks` |
| `steps[].backgroundTasks` | Les blocs `passive` de `schedules[mode].blocks` |
| `metrics.totalTime` | `schedules[mode].totalTime` |
| `metrics.idleTime` | `schedules[mode].idleTime` |
| `metrics.activeBreakdown`, `metrics.prepBreakdown`, `metrics.totalBreakdown` | `miseEnPlace` et `schedules` |
| `calculatePreparationTime().breakdown` | Les `items` de `computeMiseEnPlace()` (`calculatePreparationTime()` renvoie toujours `total`) |

`metrics.preparationTime` et `metrics.activeTime` ne sont **pas** dépréciés : ils sont identiques dans tous les plannings. Attention : l'ancien `metrics.totalTime` est le total avec toutes les préparations au début, c'est-à-dire celui du planning `upfront` sauf si la recette a des intermédiaires : `upfront` les prépare une fois qu'ils existent, et peut donc être plus court.

La page [Fonctionnalités dépréciées](/fr/docs/how-to/deprecations) donne un avant/après en code pour chacun d'eux.
:::

:::note[JSON compilé avant la 1.4.0]
Le JSON écrit par kitchen 1.3.0 ou une version antérieure n'a pas de `schedules`. Il s'affiche toujours : `scheduleTimes` lit le temps total et le temps d'attente dans l'ancien `metrics.totalTime` et `metrics.idleTime`, et le diff les compare correctement au lieu de lire zéro. En revanche, il n'y a ni mise en place ni chronologie à dessiner, donc le diagramme de Gantt reste vide. Recompilez la recette avec la 1.4.0 ou plus pour les obtenir. Ce repli disparaîtra avec les champs dépréciés en 2.0.0.
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

// Depuis la 1.4.0 : la répartition de la mise en place et les chronologies
function computeMiseEnPlace(sections: ProcessedSection[], registry: Registry): SectionMiseEnPlace[]
// ^ le champ `miseEnPlace` d'une recette compilée, déduit de ses sections

type MiseEnPlaceMode = "perSection" | "upfront" | "perSession"
const MISE_EN_PLACE_MODES: readonly ["perSection", "upfront", "perSession"]
const DEFAULT_MISE_EN_PLACE_MODE: MiseEnPlaceMode // "perSection"
function isMiseEnPlaceMode(value: unknown): value is MiseEnPlaceMode
function scheduleFor(compiled, mode?: MiseEnPlaceMode): Schedule | undefined
function scheduleTimes(compiled, mode?: MiseEnPlaceMode): { totalTime: number; idleTime: number }

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

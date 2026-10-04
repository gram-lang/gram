---
title: "@gram-lang/scheduler"
description: "Le moteur de planning : pose un graphe de tâches sur un planning, le place sur le calendrier à partir d'une heure de service et de vos disponibilités, et fabrique une fiche de production."
---

Le moteur de planning de Gram *(depuis la 1.4.0)*. Il prend un **graphe de tâches** (le champ `tasks` d'une recette compilée) et répond à deux questions : comment cela se pose-t-il dans le temps (`layout`), et quand commencer chaque tâche, sachant quand on sert et quand on peut cuisiner (`project`). Il ne connaît ni l'AST ni la recette compilée, seulement le graphe. Voir [Le moteur de planning](/fr/docs/explanation/engine/scheduler/) pour son fonctionnement et [Planifier en heures réelles](/fr/docs/explanation/planning-in-real-time/) pour ce qu'il fait pour vous.

Chaque fonction est pure : la même entrée donne toujours la même sortie, rien n'est lu sur la machine (ni horloge, ni fuseau horaire), et les entrées ne sont jamais modifiées.

```bash
npm install @gram-lang/scheduler
```

La Kitchen réexporte `layout`, `LayoutOptions` et les choix (`MISE_EN_PLACE_MODES`, `REST_CHOICES`...) : le code qui n'utilise que la Kitchen n'a pas besoin de ce paquet.

## `layout`

```typescript
function layout(graph: TaskGraph, options?: LayoutOptions): LayoutResult

interface LayoutOptions {
  miseEnPlace?: MiseEnPlaceMode; // "perSection" (défaut) | "upfront" | "perSession"
  rests?: RestChoice;            // "shortest" (défaut) | "balanced" | "longest"
  restOverrides?: Record<string, number>; // minutes pour certains repos, par identifiant de tâche (utilisé par project())
}

interface LayoutResult {
  schedule: Schedule;
  diagnostics: SchedulingDiagnostic[];
}
```

Pose le graphe sur un planning, en minutes depuis 0 (la première tâche). Le travail actif est planifié sur sa durée `nominal` quoi que dise `rests`, et chaque repos passif sur le chiffre que `rests` choisit dans sa fourchette : le plus court, le milieu, le plus long. Un repos qui n'est pas une fourchette, et un minuteur actif, ne sont pas touchés. Une valeur de `restOverrides` hors de la fourchette du repos est ignorée : aucun repos n'est jamais rallongé ni raccourci au-delà de ce que la recette permet.

```typescript
import { compile } from '@gram-lang/kitchen';
import { layout } from '@gram-lang/scheduler';

const { tasks } = compile(ast);

const { schedule, diagnostics } = layout(tasks, { miseEnPlace: 'upfront', rests: 'longest' });
// schedule.totalTime, schedule.blocks, schedule.sessions...
```

Pour le choix par défaut, `compiled.schedule` est exactement `layout(compiled.tasks).schedule`.

### `Schedule`

```typescript
interface Schedule {
  miseEnPlace: MiseEnPlaceMode;
  rests: RestChoice;
  totalTime: number;       // le end le plus tardif parmi les blocs
  activeTime: number;      // le temps passé les mains dedans, mise en place exclue
  preparationTime: number; // la mise en place : la somme des tâches `prep`
  idleTime: number;        // totalTime - activeTime - preparationTime
  blocks: ScheduleBlock[]; // triés par début, puis par fin
  sessions: ScheduleSession[]; // une par journée de travail, la plus lointaine d'abord
}

type ScheduleBlock =
  | { kind: "prep"; task: string; section: number; start: number; end: number; deferred?: true; items?: MiseEnPlaceItem[] }
  | { kind: "step"; task: string; section: number; step: number; start: number; end: number }
  | { kind: "passive"; task: string; section: number; step: number; track?: string; start: number; end: number };

interface ScheduleSession {
  day: number;      // 0 = le jour même, 1 = la veille (~{-1d})...
  start: number;    // bornes du travail actif de la session
  end: number;
  sections: number[];
}
```

Un bloc `prep` qui rassemble plusieurs préparations qui commencent et finissent ensemble porte dans `task` l'identifiant de la première.

### `SchedulingDiagnostic`

Ce que `layout()` sait dire de la recette elle-même, sous forme de données (la Kitchen les met en mots comme des avertissements) :

```typescript
type SchedulingDiagnostic =
  | { code: "TIME_PARADOX"; section: number; pulledTo: number }
  | { code: "TRACK_CONTENTION"; section: number; trackName: string; delay: number }
  | { code: "SESSION_OVERFLOW"; section: number; day: number; overflowMinutes: number };
```

`SESSION_OVERFLOW` dit que le travail actif d'une journée de travail commence avant les 24 heures dans lesquelles elle doit tenir (un long repos la repousse). Seul le travail du cuisinier compte, pas un repos qui traverse la nuit.

## Le graphe de tâches

```typescript
interface TaskGraph {
  tasks: Task[];             // les sections dans l'ordre, puis les étapes, `prep` en tête de chaque section
  sections: TaskGraphSection[]; // parallèle aux sections de la recette
}

type Task = PrepTask | StepTask | TimerTask;

interface TaskDuration {
  nominal: number; // ce sur quoi le planning par défaut se base
  min?: number;    // seulement pour un repos passif écrit en fourchette
  max?: number;
}

interface PrepTask {
  id: string; kind: "prep"; section: number;
  intermediate?: string; // présent pour la préparation d'un intermédiaire (`&pâte`)
  duration: TaskDuration; items: MiseEnPlaceItem[];
  after: string[];       // l'étape qui fabrique l'intermédiaire, quand on la connaît
}

interface StepTask {
  id: string; kind: "step"; section: number; step: number; // step : indice dans la section, commentaires compris
  duration: TaskDuration;
  produces?: string[]; consumes?: string[]; // intermédiaires, tels qu'écrits dans la recette
  after: string[];
}

interface TimerTask {
  id: string; kind: "passive"; section: number; step: number;
  track?: string;   // seulement pour une piste nommée (`~_four{}`)
  offset: number;   // minutes après le début de l'étape
  duration: TaskDuration; after: string[];
}

interface TaskGraphSection {
  day: number;           // 0 = le jour même ; seule une ancre en jours ouvre une journée
  deadline?: number;     // l'ancre, en minutes avant la fin
  intermediate?: string; // l'intermédiaire que fabrique la section entière
}
```

Les identifiants de tâches sont stables et lisibles : `s0.prep`, `s1.prep.pâte`, `s0.3`, `s0.3.t0`.

## `project`

```typescript
function project(recipes: ProjectionInput[], context: ProjectionContext): ProjectedPlan

interface ProjectionInput {
  graph: TaskGraph;
  title?: string;
  options?: LayoutOptions;
}

interface ProjectionContext {
  serveAt: string;        // une date-heure locale, "2026-10-11T13:00", dans `timeZone`
  timeZone: string;       // un fuseau IANA, "Europe/Paris"
  availability: Availability;
  now?: string;           // un instant ISO (Z ou décalage) ou une heure locale ; pour START_IN_PAST. Sans lui, rien n'est comparé à l'horloge
}

interface Availability {
  daily: TimeRange[];                                 // tous les jours, sauf exception
  weekdays?: Partial<Record<Weekday, TimeRange[]>>;   // "mon" … "sun" ; [] veut dire pas disponible
  dates?: Record<string, TimeRange[]>;                // "2026-10-09" ; l'emporte sur `weekdays`
}

interface TimeRange { start: string; end: string }   // "08:00"–"22:00" ; une fin avant le début passe minuit
```

Pose le planning d'une recette sur le calendrier, pour qu'il se termine à l'heure du service, et déplace les repos qui peuvent bouger pour que le travail du cuisinier tombe quand il est disponible. Glouton et explicable, pas optimal. Il prend dès le départ une liste de recettes mais ne planifie que la première pour l'instant (`MULTI_RECIPE_UNSUPPORTED`). Un fuseau inconnu ou une heure de service mal formée lève une `RangeError`.

```typescript
const plan = project(
  [{ graph: tasks, title: 'Country bread' }],
  {
    serveAt: '2026-10-11T13:00',
    timeZone: 'Europe/Paris',
    availability: { daily: [{ start: '08:00', end: '22:00' }], weekdays: { sun: [{ start: '09:00', end: '20:00' }] } },
  },
);
```

### `ProjectedPlan`

```typescript
interface ProjectedPlan {
  serveAt: string;
  timeZone: string;
  recipes: {
    title?: string;
    blocks: ProjectedBlock[];     // les blocs du planning, avec `start`/`end` en instants ISO (UTC)
    sessions: ProjectedSession[]; // et `startLocal`/`endLocal` : l'heure du cadran du fuseau, "2026-10-10T21:40"
  }[];
  adjustments: RestAdjustment[];  // les repos allongés ou raccourcis
  unavailable: { start: string; end: string }[]; // quand le cuisinier n'est pas disponible, dans la durée du plan
  diagnostics: ProjectionDiagnostic[];
}

interface RestAdjustment {
  task: string;
  from: number; // minutes
  to: number;
  reason: "avoid-unavailable";
}

type ProjectionDiagnostic =
  | { code: "ACTIVE_OUTSIDE_AVAILABILITY"; task: string; local: string; rest?: string }
  | { code: "ACTIVE_BLOCK_EXCEEDS_AVAILABILITY"; tasks: string[]; minutes: number; largest: number }
  | { code: "SESSION_DAY_MISMATCH"; day: number; expected: string; actual: string }
  | { code: "START_IN_PAST"; start: string; now: string }
  | { code: "MULTI_RECIPE_UNSUPPORTED"; recipes: number };
```

Ces diagnostics dépendent du contexte du lecteur : ils font partie du résultat de `project()`, ce ne sont pas des avertissements du compilateur. Voir [Planifier en heures réelles](/fr/docs/explanation/planning-in-real-time/#ce-quil-ne-peut-pas-arranger) pour le sens de chacun.

## `runSheet`

```typescript
function runSheet(plan: ProjectedPlan): RunSheet

interface RunSheet {
  serveAt: string;
  timeZone: string;
  recipes: { title?: string; days: RunSheetDay[] }[];
  diagnostics: ProjectionDiagnostic[];
}

interface RunSheetDay {
  date: string;       // "2026-10-10"
  daysBefore: number; // 0 le jour même
  entries: RunSheetEntry[]; // dans l'ordre
}

interface RunSheetEntry {
  task: string; kind: "prep" | "step" | "passive"; active: boolean;
  section: number; step?: number; track?: string;
  start: string; end: string;           // instants ISO (UTC)
  startLocal: string; endLocal: string; // exact à la minute : l'arrondi est pour l'affichage
  minutes: number;
  adjustment?: RestAdjustment;          // présent quand le plan a déplacé ce repos
}
```

La structure d'une fiche de production. Les mots et la mise en page appartiennent au moteur de rendu (`runSheetToText`, `runSheetToMarkdown`, `runSheetToHTML`, `runSheetToPrintHTML`, `describeRunSheet` ; voir la [référence du renderer](/fr/docs/reference/api/renderer/)).

## Les choix et les utilitaires

```typescript
type MiseEnPlaceMode = "perSection" | "upfront" | "perSession";
const MISE_EN_PLACE_MODES: readonly MiseEnPlaceMode[];
const DEFAULT_MISE_EN_PLACE_MODE: MiseEnPlaceMode; // "perSection"
function isMiseEnPlaceMode(value: unknown): value is MiseEnPlaceMode;

type RestChoice = "shortest" | "balanced" | "longest";
const REST_CHOICES: readonly RestChoice[];
const DEFAULT_REST_CHOICE: RestChoice; // "shortest"
function isRestChoice(value: unknown): value is RestChoice;

const WEEKDAYS: readonly ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// Des dates sans librairie de dates, à partir d'un fuseau explicite
function parseLocalIso(value: string, timeZone: string): number; // "2026-10-11T13:00" → minutes depuis l'epoch (UTC)
function parseInstant(value: string, timeZone: string): number;  // un instant ISO avec Z ou un décalage, ou une heure locale
function toLocalIso(utcMinutes: number, timeZone: string): string; // → "2026-10-11T13:00"
function toUtcIso(utcMinutes: number): string;                    // → "2026-10-11T11:00:00Z"
```

Une heure locale qui n'existe pas (2 h 30 quand on avance les horloges) devient la suivante qui existe ; une qui existe deux fois (quand on les recule) est la première.

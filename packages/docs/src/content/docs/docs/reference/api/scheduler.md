---
title: "@gram-lang/scheduler"
description: "The scheduling engine: lays a task graph out on a timeline, places it on the calendar from a serving time and your availability, and builds a production sheet."
---

The scheduling engine of Gram *(since 1.4.0)*. It takes a **task graph** (the `tasks` field of a compiled recipe) and answers two questions: how does this lay out in time (`layout`), and when do I start each task, given when I serve and when I can cook (`project`). It knows nothing about the AST or the compiled recipe, only about the graph. See [The scheduling engine](/docs/explanation/engine/scheduler/) for how it works and [Planning in real time](/docs/explanation/planning-in-real-time/) for what it does for you.

Every function is pure: the same input always gives the same output, nothing is read from the machine (no clock, no time zone), and the inputs are never modified.

```bash
npm install @gram-lang/scheduler
```

The Kitchen re-exports `layout`, `LayoutOptions` and the choices (`MISE_EN_PLACE_MODES`, `REST_CHOICES`...), so code that only uses the Kitchen doesn't need this package.

## `layout`

```typescript
function layout(graph: TaskGraph, options?: LayoutOptions): LayoutResult

interface LayoutOptions {
  miseEnPlace?: MiseEnPlaceMode; // "perSection" (default) | "upfront" | "perSession"
  rests?: RestChoice;            // "shortest" (default) | "balanced" | "longest"
  restOverrides?: Record<string, number>; // minutes for particular rests, by task id (used by project())
}

interface LayoutResult {
  schedule: Schedule;
  diagnostics: SchedulingDiagnostic[];
}
```

Lays the graph out on a timeline, in minutes from 0 (the first task). Active work is planned on its `nominal` duration whatever `rests` says, and every passive rest on the figure `rests` picks in its range: the shortest, the middle, the longest. A rest that isn't a range, and an active timer, are not affected. A value in `restOverrides` outside the rest's range is ignored, so no rest is ever made longer or shorter than the recipe allows.

```typescript
import { compile } from '@gram-lang/kitchen';
import { layout } from '@gram-lang/scheduler';

const { tasks } = compile(ast);

const { schedule, diagnostics } = layout(tasks, { miseEnPlace: 'upfront', rests: 'longest' });
// schedule.totalTime, schedule.blocks, schedule.sessions...
```

For the default choice, `compiled.schedule` is exactly `layout(compiled.tasks).schedule`.

### `Schedule`

```typescript
interface Schedule {
  miseEnPlace: MiseEnPlaceMode;
  rests: RestChoice;
  totalTime: number;       // the latest end among the blocks
  activeTime: number;      // the cook's hands-on time, mise en place excluded
  preparationTime: number; // the mise en place: the sum of the `prep` tasks
  idleTime: number;        // totalTime - activeTime - preparationTime
  blocks: ScheduleBlock[]; // sorted by start, then end
  sessions: ScheduleSession[]; // one per working day, furthest day first
}

type ScheduleBlock =
  | { kind: "prep"; task: string; section: number; start: number; end: number; deferred?: true; items?: MiseEnPlaceItem[] }
  | { kind: "step"; task: string; section: number; step: number; start: number; end: number }
  | { kind: "passive"; task: string; section: number; step: number; track?: string; start: number; end: number };

interface ScheduleSession {
  day: number;      // 0 = the day itself, 1 = the day before (~{-1d})...
  start: number;    // bounds of the session's active work
  end: number;
  sections: number[];
}
```

A `prep` block that gathers several preparations that start and end together carries the id of the first one in `task`.

### `SchedulingDiagnostic`

What `layout()` can tell about the recipe itself, as data (the Kitchen words them as warnings):

```typescript
type SchedulingDiagnostic =
  | { code: "TIME_PARADOX"; section: number; pulledTo: number }
  | { code: "TRACK_CONTENTION"; section: number; trackName: string; delay: number }
  | { code: "SESSION_OVERFLOW"; section: number; day: number; overflowMinutes: number };
```

`SESSION_OVERFLOW` says that the active work of a working day starts before the 24 hours that day is meant to fit in (a long rest pushes it back). Only the cook's own work counts, not a rest running through the night.

## The task graph

```typescript
interface TaskGraph {
  tasks: Task[];             // sections in order, then steps, `prep` first in each section
  sections: TaskGraphSection[]; // parallel to the recipe's sections
}

type Task = PrepTask | StepTask | TimerTask;

interface TaskDuration {
  nominal: number; // what the default timeline plans on
  min?: number;    // only for a passive rest written as a range
  max?: number;
}

interface PrepTask {
  id: string; kind: "prep"; section: number;
  intermediate?: string; // set for the preparation of an intermediate (`&dough`)
  duration: TaskDuration; items: MiseEnPlaceItem[];
  after: string[];       // the step that makes the intermediate, when known
}

interface StepTask {
  id: string; kind: "step"; section: number; step: number; // step: index in the section, comments included
  duration: TaskDuration;
  produces?: string[]; consumes?: string[]; // intermediates, as written in the recipe
  after: string[];
}

interface TimerTask {
  id: string; kind: "passive"; section: number; step: number;
  track?: string;   // only for a named track (`~_oven{}`)
  offset: number;   // minutes after the step's start
  duration: TaskDuration; after: string[];
}

interface TaskGraphSection {
  day: number;           // 0 = the day itself; only an anchor in days opens a day
  deadline?: number;     // the anchor, in minutes before the end
  intermediate?: string; // the intermediate the section as a whole makes
}
```

Task ids are stable and readable: `s0.prep`, `s1.prep.dough`, `s0.3`, `s0.3.t0`.

## `project`

```typescript
function project(recipes: ProjectionInput[], context: ProjectionContext): ProjectedPlan

interface ProjectionInput {
  graph: TaskGraph;
  title?: string;
  options?: LayoutOptions;
}

interface ProjectionContext {
  serveAt: string;        // a local date-time, "2026-10-11T13:00", in `timeZone`
  timeZone: string;       // an IANA zone, "Europe/Paris"
  availability: Availability;
  now?: string;           // an ISO instant (Z or offset) or a local time; for START_IN_PAST. Without it, nothing is checked against the clock
}

interface Availability {
  daily: TimeRange[];                                 // every day, unless an exception says otherwise
  weekdays?: Partial<Record<Weekday, TimeRange[]>>;   // "mon" … "sun"; [] means not available
  dates?: Record<string, TimeRange[]>;                // "2026-10-09"; wins over `weekdays`
}

interface TimeRange { start: string; end: string }   // "08:00"–"22:00"; an end before the start runs past midnight
```

Places the timeline of a recipe on the calendar, ending when it is served, and moves the rests that can move so the cook's own work falls when they are available. Greedy and explainable, not optimal. It takes a list of recipes from the start but plans only the first one for now (`MULTI_RECIPE_UNSUPPORTED`). An unknown time zone or a malformed serving time throws a `RangeError`.

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
    blocks: ProjectedBlock[];     // the blocks of the schedule, with `start`/`end` as ISO instants (UTC)
    sessions: ProjectedSession[]; // and `startLocal`/`endLocal`: the wall clock of the zone, "2026-10-10T21:40"
  }[];
  adjustments: RestAdjustment[];  // the rests made longer or shorter
  unavailable: { start: string; end: string }[]; // when the cook is not available, within the plan
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

These diagnostics depend on the reader's context, so they are part of the result of `project()`, not compiler warnings. See [Planning in real time](/docs/explanation/planning-in-real-time/#what-it-cannot-fix) for what each means.

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
  daysBefore: number; // 0 on the day itself
  entries: RunSheetEntry[]; // in order
}

interface RunSheetEntry {
  task: string; kind: "prep" | "step" | "passive"; active: boolean;
  section: number; step?: number; track?: string;
  start: string; end: string;           // ISO instants (UTC)
  startLocal: string; endLocal: string; // exact to the minute: rounding is for display
  minutes: number;
  adjustment?: RestAdjustment;          // set when the plan moved this rest
}
```

The structure of a production sheet. The words and the layout belong to the renderer (`runSheetToText`, `runSheetToMarkdown`, `runSheetToHTML`, `runSheetToPrintHTML`, `describeRunSheet`; see the [renderer reference](/docs/reference/api/renderer/)).

## Choices and helpers

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

// Dates without a date library, from an explicit zone
function parseLocalIso(value: string, timeZone: string): number; // "2026-10-11T13:00" → minutes since the epoch (UTC)
function parseInstant(value: string, timeZone: string): number;  // an ISO instant with Z or an offset, or a local time
function toLocalIso(utcMinutes: number, timeZone: string): string; // → "2026-10-11T13:00"
function toUtcIso(utcMinutes: number): string;                    // → "2026-10-11T11:00:00Z"
```

A local time that doesn't exist (02:30 when the clocks go forward) becomes the next valid one; one that happens twice (when they go back) is the first.

# @gram-lang/scheduler

[![npm](https://img.shields.io/npm/v/@gram-lang/scheduler?color=cb3837&style=flat-square)](https://www.npmjs.com/package/@gram-lang/scheduler)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

*Part of the [Gram monorepo](https://git.gram-lang.org/gram-lang/gram).*

The scheduling engine behind Gram recipes. It lays tasks out on a timeline (as-late-as-possible backward pass, named-track contention, mise en place placement, working days) from a neutral description of the work, and knows nothing about the Gram AST or the compiled recipe: `@gram-lang/kitchen` feeds it and writes the result into the compiled JSON.

---

## 📚 General Documentation

For full scheduling concepts, availability settings, and run sheet details, please refer to the **[Gram Documentation](https://gram-lang.org/docs/)**.

---

## 🛠️ Installation

```bash
npm install @gram-lang/scheduler
# or
bun add @gram-lang/scheduler
```

---

## ⚡ Usage

```typescript
import { getAST } from '@gram-lang/parser';
import { compile } from '@gram-lang/kitchen';
import { layout, project, runSheet } from '@gram-lang/scheduler';

const compiled = compile(getAST('## Dough\n\n[Mix] @flour{500g}.\n\n[Rest] ~_{8-16h}.\n'));

// 1. Re-lay out the timeline without re-compiling
const { schedule } = layout(compiled.tasks, { miseEnPlace: 'upfront', rests: 'balanced' });

// 2. Project onto a calendar working backward from serving time
const plan = project([{ graph: compiled.tasks }], {
  serveAt: '2026-10-17T20:00',
  timeZone: 'Europe/Paris',
  availability: { daily: [{ start: '08:00', end: '22:00' }] }
});

// 3. Group into days, kitchen visits, and background threads
const sheet = runSheet(plan, { graph: compiled.tasks });
```

## 🏗️ API Overview

- `layout(tasks, { miseEnPlace, rests })` lays a task graph out on a timeline, in minutes from the start.
- `project([{ graph }], { serveAt, timeZone, availability })` places that timeline on the calendar, ending at the serving time, and moves the rests written as a range so the cook's own work falls when they are available. It reads no clock and no time zone of the machine: the same input always gives the same plan.
- `runSheet(plan | schedule, { graph, context })` groups a plan (or a bare schedule, in days before the service) into the days, the visits to the kitchen and the threads that go on without the cook, with the margin of each visit.
- `findServeTimes()` and `earliestServe()` try serving times with `project()` and tell which can be followed, and why the others cannot.
- `parseAvailability()`, `parseMealTimes()`, `isTimeZone()`, `availabilityEntries()` and `isCalendarDate()` read and check a project's settings (`08:00-22:00`, `fri=18:00-22:00`, `2026-10-09=none`), so the CLI and the editor read them the same way; a date that does not exist (a 30th of February) is refused instead of moved to the next month.
- Each visit of the run sheet lists the sections it cooks and when each starts, and `visitSections()` gives the sections to name a visit after.
- `MISE_EN_PLACE_MODES` (`perSection`, `upfront`, `perDay`) and `REST_CHOICES` (`shortest`, `balanced`, `longest`) are the choices `layout()` takes, with their defaults and guards.

---

## 📄 License

This project is licensed under the GPL-3.0 License.

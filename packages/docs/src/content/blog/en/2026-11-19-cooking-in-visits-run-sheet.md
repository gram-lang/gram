---
title: "The 7-minute mystery: why Gram schedules your kitchen in \"visits\""
date: 2026-11-19
locale: "en"
topic: "Devlog"
description: "How a 7-minute discrepancy led to eliminating hidden compiler timings, replacing the Gantt chart, and designing the visit-based run sheet."
---

*"My recipe only has 54 minutes of timers, yet Gram shows 1 h 01 min. Where are those extra 7 minutes coming from?"*

That question on Reddit (alongside a remark about mise en place being lumped together at the very start) looked like a minor rounding quirk at first glance. Inspecting the compiler revealed a deeper issue: Gram's timing model was out of touch with real cooking.

Pulling on that thread led to a complete overhaul in [Gram 1.4.0](/blog/2026-11-13-release-1.4.0/): retiring the Gantt view, rethinking time around a visit-based **run sheet**, and extracting scheduling into `@gram-lang/scheduler`.

## The 7-minute mystery: the black-box trap

The user's message pointed out two related contradictions:

1. **The mystery of calculated durations**: where did those phantom 7 minutes come from when no timer in the recipe mentioned them?
2. **The organizational mismatch**: *"In my `.gram` recipe, my ingredients are neatly organized by section, which implies I prep my filling right before working on the filling. Yet in your schedule, all mise en place is crammed at the very beginning (`t = 0`). Why should I pull out my butter at minute zero for a step that happens much later?"*

Looking at what `kitchen` was doing under the hood revealed a classic **black-box effect**:

- To estimate prep work, the compiler silently added hidden durations (1 minute per ingredient or piece of cookware to fetch, plus 2 minutes whenever manual prep like *dicing onions* appeared).
- Because the recipe did not specify *when* to perform those actions, everything was packed at the very start.
- Yet in real life, if you chop a filling while dough rests (what cooks call **masked time**), those 7 minutes do not lengthen the recipe. By stacking them at `t = 0`, before you even touched the dough, the algorithm artificially stretched the overall duration.

Fixing this seemed simple at first: just move prep right before each section. But that adjustment exposed a more fundamental limit: **the moment you let the cook choose *when* to do mise en place** (right before each section, all upfront, or grouped by day), **the very idea of a single fixed "total time" baked into the recipe collapses mathematically**.

A recipe does not have an absolute duration. Its duration depends on how the cook organizes their work, and the compiler had to stop inventing implicit minutes.

## The tempting wrong turn: the timeline chart

Then came the display question. Early on, Gram's schedule relied on a **Gantt chart**. On a computer monitor, horizontal bars for kneading, baking, and hatched blocks for resting... it looked sharp. It gave the impression of bringing aerospace rigor to a loaf of sourdough.

Put to the test in an actual kitchen—especially once mise en place moves to the right moment and recipes span longer stretches—a Gantt chart becomes an ergonomic dead end:

1. **The illusion of continuous time**: a Gantt chart is built for assembly lines where a waiting bar represents a blocked resource. In a kitchen, while brioche dough cold-proofs for 8 hours, the cook walks away. You sleep, go to work, live your day. Drawing a 1,500-pixel-wide timeline for 5 minutes of human action and 12 hours of empty air serves no purpose.
2. **The linear-scale trap**: if you place 2 minutes of weighing the filling right before its morning step the next day, a linear scale crushes the action. Those 2 minutes shrink into an invisible half-pixel sliver wedged between two overnight deserts.
3. **It answers the wrong questions**: with flour on your hands, nobody wants to decode an x-axis and do mental subtraction. Walking into the kitchen, you want immediate answers to three questions:
   - *"What do I need to take out onto the counter right now?"*
   - *"What are my immediate steps?"*
   - *"When do I need to come back?"*

Visually appealing on screen, the Gantt chart broke down the moment you tied on an apron. I eventually removed it from all interfaces in Gram 1.4 to start back from the physical reality of the countertop, taking cues from how professional kitchen brigades organize their work.

## Thinking of cooking in "visits"

How do people actually think about time when cooking? A recipe spanning several hours or days is not an unbroken ribbon of time: it is a series of **short visits to the kitchen**.

- **Visit 1 (the evening before, 20 min)**: knead the dough, start the first cold fermentation.
- **Visit 2 (the next morning, 15 min)**: shape the loaves, prep the filling, start the second proof.
- **Visit 3 (noon, 30 min)**: preheat, bake, and serve.

Between visits, the kitchen is clean (well, it should be!), dark, and empty.

That shift in perspective gave rise to the **run sheet**, the view that replaces the linear timeline in Gram. Rather than an abstract graph, the engine first outputs a compact overview, followed by a self-contained work card for each visit:

```text
SAT 10   ▮ 9:40 PM – 10:00 PM  Dough
         ┆ Dough : Bulk proof 14 h 30 min (8–16 h)
SUN 11   ▮ 12:30 PM – 1:00 PM  Bake
         ★ 1:00 PM             Serve
```

Each visit (`▮`) is structured in **three clear parts** for the cook:

1. **Mise en place**: only what needs to come out for *this* session (ingredients to weigh, required cookware, earlier preps to pull from the fridge).
2. **Execution**: the numbered steps to run through right away, with their actual timers and temperatures.
3. **Before leaving**: what continues without you (*"Dough : Bulk proof 14 h 30 min"*) and when to return (*"Next visit: Sunday 12:30 PM"*).

No phantom durations, no horizontal bars of empty space: every minute displayed maps to a concrete action in the current visit.

## Separating the recipe from the calendar with `@gram-lang/scheduler`

This overhaul also exposed an architectural limit: the `kitchen` compiler was trying to do too much at once. It parsed and compiled the recipe, yet also computed rigid schedules as if it knew your daily routine.

A `.gram` file knows nothing about your dinner time, when you sleep, or when you get home from work.

All time computation was therefore extracted out of `kitchen` into a dedicated package, `@gram-lang/scheduler`, with a strict boundary:

- **`kitchen`** compiles the recipe into a neutral graph of tasks, equipment tracks, and culinary constraints (*"knead, proof between 8 h and 16 h, bake 30 min"*), without assuming anything about your schedule.
- **`scheduler`** projects that graph onto real calendar time once you provide a serving time and availability windows (`gram plan recipe.gram --serve "2026-11-22 13:00" --available "08:00-22:00"`).

That decoupling unlocks flexibility that used to be impossible. Take a dough whose proof tolerates between 8 and 16 hours (`~_{8-16h}`) for a Sunday meal at 1:00 PM, while you sleep between 10:00 PM and 8:00 AM. With the minimum 8-hour proof, you would have to knead at 4:10 AM. Instead of waking you in the middle of the night, the scheduler **automatically stretches the wait to 14 h 30 min** (within the exact bounds allowed by the recipe) to place kneading on Saturday evening at 9:40 PM, right before bedtime.

Similarly, because the recipe graph is independent of its calendar projection, you can freely pick your mise en place strategy (`per-section` by default, `upfront`, or `per-day`) without ever editing the `.gram` file. If you want to explore these options in detail, they are covered in the [Planning and run sheets](/docs/explanation/planning/) guide and the [`gram plan`](/docs/how-to/plan-a-meal/) how-to.

## Wrapping up

Modeling culinary time is a complex and fascinating problem, precisely because a domain-specific language (DSL) works best when it avoids forcing software metaphors onto a hands-on craft. Release 1.4 lays what I hope are solid foundations for time management anchored in real kitchens, with one simple goal: telling you at the right moment, *"Pull out your butter now, shape the dough, and see you at noon."*

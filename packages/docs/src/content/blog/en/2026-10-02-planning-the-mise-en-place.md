---
title: "Planning the mise en place: ingredients, preparation and timing"
date: 2026-10-02
locale: "en"
topic: "Devlog"
description: "Why Gram keeps what a recipe needs, the work of preparing it and when that work happens as three separate things, what 1.4 changed, and the new planning by working day for recipes over several days."
---

While finishing 1.4, I reread the new mise en place planning and something bothered me. Not a bug, but a confusion that had been there since the start: I was using one word, "preparation", for three different things.

### Three things, not one

When you read a recipe, you can be asking three different questions:

- **What do I need?** The ingredient lists and the shopping list.
- **What work does it take to get it ready?** Fetching, weighing, peeling, chopping. This is the mise en place, and each section has its own cost.
- **When do I do that work?** The timeline, the total time, the idle time.

The first two are facts about the recipe. Only the third is a choice, and it belongs to whoever is cooking: the same recipe can be organized in several ways depending on the kitchen, the people and the day.

So I wrote down a rule that Gram already followed without saying it: **choosing a planning never changes the ingredient lists, the shopping list, the preparation time or the active time.** It only moves the work along the timeline. The new page [Ingredients, mise en place and planning](/docs/explanation/mise-en-place-and-planning/) explains this with a worked example.

### What I fixed before 1.4

The second thing I noticed was in the "all at the start" planning. It put every preparation at the very beginning, including weighing an intermediate (`&dough`), which doesn't exist until the section making it has been done. On paper that was wrong, and in a real kitchen nobody does it.

Now an intermediate is always gathered right before the section that uses it, in all the plannings. "All at the start" has become a real mix: the raw ingredients and the cookware first, the intermediates as they appear. Nothing changes for a recipe without intermediates.

### Working in sessions

Then there was the case I hadn't solved. A professional doesn't plan section by section, nor everything at once: they plan in **sessions**. On a recipe over three days, you prepare each day what that day needs, not necessarily for all the steps of all the days. And inside a day, some intermediates only exist at that moment.

The answer I settled on adds no syntax: a third reading choice, **by working day**. The days come from something you already write, the retro-planning anchors:

- A section anchored `~{-3d}` is worked on D-3, one anchored `~{-36h}` on D-1, and `~{-12h}` on the day itself.
- A section without an anchor takes the day of the next anchor, like in the backward scheduling. After the last anchor, it is the day itself.
- Each day starts with its own mise en place. An intermediate made on an earlier day is gathered at the start of the day that uses it; one made the same day waits until right before the section that uses it.

That gives one production sheet per day. A recipe with no anchor of a day or more is a single day, and the planning is then the same as "all at the start". Nothing to learn, nothing to configure, and it adds to what exists without breaking anything.

While trying it on a four-day vanilla tart, I also learned something about anchors: two sections of the same day where one needs the other can't both be anchored `~{-1d}`, because each anchor is a deadline. Space them out (`~{-26h}`, then `~{-25h}`) and both stay on D-1. The [ALAP scheduling](/docs/explanation/alap-scheduling/) page now says so.

### Try it on your recipes

If you have a recipe that is worked over several days or in several stages, try `gram view recipe.gram --mise-en-place per-session`, or the new "By working day" choice in the playground. If it doesn't match how you would organize the days, send it my way: real recipes are what will tell me whether the days should come from somewhere else than the anchors.

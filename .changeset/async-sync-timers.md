---
"@gram-lang/docs": minor
---

docs: update timer terminology from synchronous/asynchronous to active/passive

To better align with real-world culinary concepts and eliminate confusion, the terminology for timers has been updated throughout the documentation. 

Previously, Gram used computer-science terms (`synchronous` / `asynchronous`) to describe how timers affected the recipe flow. However, in a kitchen environment, almost all timers block the preparation itself, even if they run in the background.

To clarify this, we have shifted the terminology to focus on the cook's availability rather than the execution thread:
- **Synchronous** timers are now referred to as **Active** timers. These timers require the cook's attention and add to the `activeTime` metric.
- **Asynchronous** (`~&`) timers are now referred to as **Passive** (or Idle) timers. These timers represent background tasks (like resting or baking) that free up the cook to perform other steps concurrently.

**Note:** This is a purely conceptual nomenclature change to make the documentation and learning curve more intuitive for non-developers. The underlying syntax (`~{}` and `~&{}`) and the compiler's Gantt chart logic remain exactly the same.

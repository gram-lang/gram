---
title: "Cheatsheet"
description: "A quick reference table of Gram's syntax: ingredients, cookware, timers, temperatures, and their modifiers."
---

A quick reference guide to the Gram syntax.

## Basic elements

| Element | Syntax | Example | Description |
|---|---|---|---|
| **Ingredient** | `@name[{qty}]` | `@flour{200g}`, `@salt` | Adds an `@ingredient`. Omitting `{}` implies no specific quantity. |
| **Cookware** | `#name[{qty}]` | `#pan{2}`, `#pan` | Requires specific `#cookware`. Omitting `{}` defaults to `1`. |
| **Timer** | `~{time}` | `~{30min}` | An active `~timer` duration. |
| **Temperature** | `^{temp}` | `^{180C}` | An exact `^temperature` (`C`/`F`, case-insensitive). |

## Modifiers

Modifiers are placed immediately after the `@` or `#` symbol.

| Modifier | Example | Effect |
|---|---|---|
| `&` (Reference) | `@&flour` | References a previously declared `@ingredient`. Does NOT add it to the shopping list again. |
| `=` (Fixed) | `@=salt{1 tsp}` | Marks the quantity as fixed. It will **not** scale with portions. |
| `?` (Optional) | `@?thyme` | Marks the `@ingredient` as optional. |
| `-` (Hidden) | `@-sugar` | Hides the `@ingredient` from the generated shopping list. |
| `*` (Baker's %) | `@*flour{500g}` | Marks the `@ingredient` as the reference (100%) for baker's percentages. |

## Advanced syntax

| Feature | Syntax | Example |
|---|---|---|
| **Range** | `qty-qty` | `@eggs{2-4}` |
| **Alternatives** | `\|` | `@milk{100ml}\|@water{95ml}` |
| **Short-hand Prep** | `(...)` | `@butter{10g}(room temp)` |
| **Alias (Rename)** | `:display` | `@dry white wine:wine{10ml}` |
| **Relative Qty** | `% @&target` | `@water{70% @&flour}` |
| **Composite** | `<@parent` | `@lemon zest{1}<@lemon` |
| **Passive Timer** | `~_` | `~_{1h}` |
| **Named Timer** | `~name{...}`| `~eggs{3min}` |
| **Semantic Temp**| `^{text}` | `^{medium heat}` |
| **Mixed Fraction** | `n n/d` | `@flour{1 1/2 cups}` |
| **Unicode Fraction** | `½` `¾` … | `@sugar{½ cup}` |

## Intermediate variables

Used to declare sub-components (like a dough or sauce) that are referenced later.

| Location | Syntax | Example | Scope |
|---|---|---|---|
| **End of a Step** | `->&name` | `Mix until smooth. ->&dough` | Captures only that step. |
| **End of a Section**| `->&name` | `## Puff Pastry ->&pastry` | Captures the entire `## Section`. |

## Section scheduling (retro-planning)

Placed anywhere in a section title to indicate preparation timeframe.

| Syntax | Example | Meaning |
|---|---|---|
| `~{-time}` | `## Dough ~{-2d}` | Prepare 2 days in advance. |



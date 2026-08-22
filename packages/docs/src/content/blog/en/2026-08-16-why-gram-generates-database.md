---
title: "Why Gram generates your ingredient database instead of bundling one"
date: 2026-08-16
locale: "en"
topic: "Devlog"
description: "Why I abandoned the idea of bundling CIQUAL or USDA, and how Gram ended up with on-demand, user-tailored ingredient databases."
---

When I started working on Gram, my initial goal was fairly modest: build a clean, human-readable plain-text syntax for writing cooking recipes. At the time, automated nutrition was not really on my radar. But as soon as I shared the project and received my first feedback, several people immediately asked about calculating calories and macronutrients. I thought it was a brilliant idea, so I decided to look into it right away.

It didn't seem totally out of reach at the time, and I was excited to explore it. In reality, managing ingredient data and ensuring decent data quality turned out to be one of the most frustrating parts of the project — and something I completely underestimated when I began.

## The natural instinct: "Just bundle a database"

My first reaction was what most developers would probably do: find an authoritative food database, bundle it with the CLI, and call it a day. France has CIQUAL, the United States has the USDA FoodData Central, and there is also OpenFoodFacts for packaged goods.

Back in early 2026, I spent a lot of time trying to build a centralized reference database for Gram. The idea was to ship a ready-made catalog with hundreds (if not thousands) of pre-calculated ingredients. It did not take long before the whole approach hit a wall.

First, there was the sheer practicality of it. Bundling thousands of items creates a bloated dataset where 95% of the entries will never be used in any given kitchen. More importantly, keeping that catalog accurate and up to date over time is a massive maintenance burden for a small open-source project.

Second, and more fundamentally, there is no such thing as a universal ingredient. French AOP butter has around 82% fat, while standard American butter typically sits around 80%. French T45 pastry flour does not have the same density or protein content as American all-purpose flour. An entry from CIQUAL is accurate in France, while an entry from the USDA is accurate in the United States. Neither is "the" true value for butter or flour. The only real truth is the product sitting in your fridge, with the label you can read on its wrapper.

## Language is messy and personal

Unlike general-purpose programming languages where keywords like `function` or `import` are strict English tokens, Gram is meant to be written naturally in whatever language you speak. It's a natural recipe language after all.

Even within the same language, everyone names things differently. In my own recipes, I often write "liquid vanilla" (makes more sense in French, believe it or not :D) even if "vanilla extract" is technically more formal. If you write your recipes in an editor with Gram's Language Server, typing `@van...` should offer auto-completion for how you naturally write, not force you to remember an arbitrary official name from a government table. Static name matching fails as soon as real people start writing real recipes.

At one point, I thought about community-contributed YAML files that users could download and merge by cuisine. But when I thought through what would actually be in those files, the idea hit a dead end. The ingredients universal enough to never cause naming or regional disputes — like water, table salt, or white sugar — are the exact ones that AI models or basic lookups handle without breaking a sweat. For everything else (regional cheeses, specific cuts of meat, local produce), static files fail for the exact same reasons: naming variations and regional differences.

## Flipping the model: on-demand and local

Eventually, I decided to take the opposite approach: instead of forcing recipes into a massive external catalog, Gram generates a lean `ingredients.yaml` file right inside your project, built around the ingredients you actually use.

It is worth mentioning that managing an ingredient database is entirely optional in Gram. The syntax and recipe rendering work without one. Having a database simply unlocks the Analyzer — giving you automated nutrition, density conversions (such as converting 150 ml of honey to grams), and portion math.

By keeping the database local and tailored to your project, you end up with a small file of maybe 40 to 80 ingredients. It stays lightweight, keeps editor autocompletion uncluttered, and respects your personal vocabulary.

## Dealing with accuracy and reality

The obvious trade-off with generating data locally — and using AI to help fill in missing numbers — is accuracy. But pragmatically speaking, unless you send every cooked dish to a food chemistry laboratory, recipe-level nutrition is always an approximation. Water evaporates during cooking, fruit sweetness varies by season, and cuts of meat differ in fat marbling. The goal is not to pretend we have laboratory-grade precision down to the milligram, but to provide consistent, sensible baselines so you can compare recipes and track meals reliably.

To keep AI-generated estimates grounded, I wanted to put several guardrails in place across the CLI rather than treating the model as a black box.

When `gram db sync` scans your recipes, it only creates entries for what you wrote. If your naming habits have been inconsistent across recipes — such as writing `@carrot{}` in one recipe and `@carrots{}` in another — `gram db lint` uses AI as a semantic linter to catch plurals and obvious synonyms, offering to merge them under a single entry with declared aliases.

When you run `gram db enrich` to populate missing densities and macronutrients, the AI output is constrained upfront by strict physical boundaries in code: calories cannot exceed 900 kcal per 100g (since pure fat is around 900 kcal), and densities must remain within plausible ranges. The prompt also uses few-shot examples to anchor orders of magnitude across liquids, powders, and countable items, while relying on standardized culinary categories as ground truth.

The CLI then runs an interactive prompt where you can review every suggestion, edit numbers on the fly, accept them, or skip them. Anything accepted as-is gets tagged with a `# [LLM]` comment in `ingredients.yaml`, so you always know what came from a model and what you verified yourself.

Afterward, `gram db validate` runs physical sanity checks on the file. It cross-checks calories against the Atwater formula (around 4 kcal/g for carbs and protein, 9 kcal/g for fat), verifies that sub-macros like sugars do not exceed total carbohydrates, and checks that ingredient densities make physical sense for their culinary category.

## User control and what comes next

Of course, you do not have to use AI at all. If you want exact numbers for the ingredients you buy regularly, you can simply read the nutrition label on the back of the package and type them straight into `ingredients.yaml`. All disk operations use file locks and atomic writes so your manual edits will not be corrupted by background tasks or the language server.

Looking ahead, local databases also mean shared recipes adapt to where they are being cooked. If a French recipe using French butter is rendered with a US database, the nutritional profile will reflect American butter. That feels more truthful than forcing one country's agricultural data onto another.

Currently, Gram passes the project language to help give context to AI estimates, but I am thinking about adding an optional region or country setting in `config.yaml` to make local estimates even closer to local grocery realities. I am also considering better tooling — whether in the CLI or through visual interfaces — to make inspecting and managing `ingredients.yaml` as smooth as possible.

## Wrapping up

Managing ingredient data in a recipe language is tricky, and there probably isn't a single perfect answer. But letting each project maintain its own small, local database feels like a much healthier compromise than pretending a global table can fit every kitchen.

The `gram db` workflow is still relatively young and will likely keep evolving. If you're using Gram, I'd love to hear how it holds up with your own recipes and ingredients.
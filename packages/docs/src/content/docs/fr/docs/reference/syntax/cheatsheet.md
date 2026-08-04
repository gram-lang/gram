---
title: "Antisèche (Cheatsheet)"
description: "Un tableau de référence rapide de la syntaxe Gram : ingrédients, matériel, minuteurs, températures et leurs modificateurs."
---

Un guide de référence rapide de la syntaxe Gram.

## Éléments de Base

| Élément | Syntaxe | Exemple | Description |
|---|---|---|---|
| **Ingrédient** | `@nom[{qté}]` | `@farine{200 g}`, `@sel` | Ajoute un `@ingrédient`. Omettre `{}` implique aucune quantité spécifique. |
| **Matériel** | `#nom[{qté}]` | `#poêle{2}`, `#poêle` | Requiert un `#matériel` spécifique. Omettre `{}` vaut `1` par défaut. |
| **Minuteur** | `~{temps}` | `~{30 min}` | La durée d'un `~minuteur` actif. |
| **Température** | `^{temp}` | `^{180C}` | Une `^température` exacte (`C`/`F`, insensible à la casse). |

## Modificateurs

Les modificateurs sont placés immédiatement après le symbole `@` ou `#`.

| Modificateur | Exemple | Effet |
|---|---|---|
| `&` (Référence) | `@&farine` | Fait référence à un `@ingrédient` déclaré précédemment. Ne l'ajoute PAS une seconde fois à la liste de courses. |
| `=` (Fixe) | `@=sel{1 c.à.c}` | Marque la quantité comme fixe. Elle **ne sera pas** mise à l'échelle avec les portions. |
| `?` (Optionnel) | `@?thym` | Marque l'`@ingrédient` comme facultatif. |
| `-` (Masqué) | `@-sucre` | Masque l'`@ingrédient` de la liste de courses générée. |
| `*` (% Boulanger)| `@*farine{500 g}` | Marque l'`@ingrédient` comme référence (100 %) pour les pourcentages du boulanger. |

## Syntaxe Avancée

| Fonctionnalité | Syntaxe | Exemple |
|---|---|---|
| **Plage** | `qté-qté` | `@œufs{2-4}` |
| **Alternatives** | `\|` | `@lait{100 ml}\|@eau{95 ml}` |
| **Préparation courte** | `(...)` | `@beurre{10 g}(à temp. ambiante)` |
| **Alias (Renommer)** | `:affichage` | `@vin blanc sec:vin{10 ml}` |
| **Qté Relative** | `% @&cible` | `@eau{70% @&farine}` |
| **Composite** | `<@parent` | `@zeste{1}<@citron` |
| **Minuteur Passif** | `~_` | `~_{1 h}` |
| **Minuteur Nommé** | `~nom{...}`| `~œufs{3 min}` |
| **Temp. Sémantique**| `^{texte}` | `^{feu moyen}` |
| **Fraction mixte** | `n n/d` | `@farine{1 1/2 tasse}` |
| **Fraction Unicode** | `½` `¾` … | `@sucre{½ tasse}` |

## Variables Intermédiaires

Utilisées pour déclarer des sous-composants (comme une pâte ou une sauce) qui sont référencés plus tard.

| Emplacement | Syntaxe | Exemple | Portée |
|---|---|---|---|
| **Fin d'une Étape** | `->&nom` | `Mélanger bien. ->&pâte` | Capture uniquement cette étape. |
| **Fin d'une Section**| `->&nom` | `## Pâte Feuilletée ->&pâte`| Capture l'ensemble de la `## Section`. |

## Ordonnancement de Section (Rétroplanning)

Placé n'importe où dans un titre de section pour indiquer un délai de préparation.

| Syntaxe | Exemple | Signification |
|---|---|---|
| `~{-temps}` | `## Pâte ~{-2d}` | Préparer 2 jours à l'avance. |

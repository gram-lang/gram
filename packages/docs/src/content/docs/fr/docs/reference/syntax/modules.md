---
title: "Imports de Modules"
description: "Importez un autre fichier .gram comme sous-composant réutilisable avec @use, et découvrez comment la mise à l'échelle, l'encapsulation et la liste de courses fonctionnent entre plusieurs fichiers."
---

Une recette peut `@use` un autre fichier `.gram` comme sous-composant réutilisable — une pâte sablée, un bouillon, une fournée de blancs d'œufs — plutôt que de copier-coller ses étapes dans chaque recette qui en a besoin.

```gram
---
title: 'Tarte au Citron Meringuée'
---

@use "./bases/pate-sablee.gram" as &pate

## Montage

[Foncer] le moule avec &pate{250g}.

[Garnir] avec @creme-citron{300g}.
```

Les étapes de la recette importée sont intégrées à la timeline exactement comme si vous les aviez copiées-collées à la main : le temps de repos d'une base s'entrelace toujours avec le reste de ce qui se passe dans la recette, et ses ingrédients fusionnent avec la même liste de courses que celle de l'hôte.

## Syntaxe

Les directives `@use` se placent juste après le frontmatter, avant toute étape — voir [Structure du Document](/fr/docs/reference/syntax/document-structure#2-imports-de-modules).

```gram
@use "./bases/pate-sablee.gram" as &pate
@use "./bases/oeufs.gram" as { &blancs, &jaunes }
@use "./bases/creme.gram" as { &creme as &creme-patissiere }
```

*   **Binding par défaut** — `as &nom` lie l'export par défaut du module à `&nom`.
*   **Bindings déstructurés** — `as { &a, &b }` lie plusieurs exports du module à la fois. Ajoutez `as &nouveauNom` après l'un d'eux pour le lier sous un nom local différent (`as { &a as &renomme, &b }`).
*   **`prepared`** — un modificateur optionnel après les bindings (`as &pate prepared`) qui importe le module comme une boîte noire opaque plutôt que d'intégrer ses étapes — voir [Mode prepared (boîte noire)](#mode-prepared-boîte-noire) ci-dessous.
*   **Noms à plusieurs mots** — comme pour une [variable intermédiaire](/fr/docs/reference/syntax/intermediate-variables), entourez un nom contenant des espaces avec `{}` : `as &pate feuilletée{}`, ou des deux côtés d'un renommage déstructuré `{ &pate feuilletée{} as &pâte }`.
*   Le specifier doit se terminer par `.gram`, et être soit un chemin relatif (`./`, `../`), soit la racine du projet (`@/`), soit un alias `paths:` nommé (`@alias/`) — voir ci-dessous. Seuls les fichiers à l'intérieur de votre projet sont résolvables — un chemin absolu ou une URL est rejeté.

## Chemins racine de projet et alias

Les specifiers `./`/`../` se résolvent par rapport au *répertoire du fichier importateur lui-même* — pratique pour une base assise à côté de sa recette, malcommode pour une base partagée depuis trois répertoires plus loin. `@/` désigne toujours la racine du projet à la place (le plus proche ancêtre contenant `.gram/`), quel que soit l'emplacement du fichier importateur :

```gram
@use "@/bases/pate-sablee.gram" as &pate
```

Pour un nom plus court qu'un long chemin relatif, ou pour une base qui vit entièrement en dehors de la racine du projet (par exemple un répertoire partagé de recettes de famille), déclarez un alias `paths:` dans `.gram/config.yaml` :

```yaml
paths:
  bases: ./shared/bases
```

```gram
@use "@bases/pate-sablee.gram" as &pate
```

Chaque alias se résout vers un répertoire relatif à la racine du projet, et tout chemin qu'il produit reste confiné à la racine du projet — un alias ne peut pas être utilisé pour sortir de votre projet.

## Ce qu'un module exporte

Seuls les intermédiaires **de niveau section** (`->&` en fin de titre `## Section`) sont visibles pour un importateur — un `->&` de niveau étape reste privé au fichier qui le déclare. Voir [Variables Intermédiaires](/fr/docs/reference/syntax/intermediate-variables) pour la différence entre les deux.

```gram
## Blancs ->&blancs

Séparer @oeuf{100g}.

## Jaunes ->&jaunes

Séparer @oeuf{50g}.
```

Un module qui ne possède qu'un seul `->&` l'exporte comme export **par défaut** — la cible de la forme simple `as &nom`. Un module à plusieurs exports, ou sans aucun, retombe sur ce que produit sa dernière section ; importez-le avec du destructuring (`as { &blancs, &jaunes }`) pour atteindre un export précis.

Un module ne réexporte jamais ce qu'il importe lui-même — si `sauce.gram` utilise `&bouillon` en provenance de `base.gram`, importer `sauce.gram` vous donne `&sauce`, pas `&bouillon`. Un module qui veut délibérément exposer une base le fait explicitement, avec sa propre section :

```gram
@use "./base.gram" as &bouillon-base

## Bouillon ->&bouillon

[Réserver] le &bouillon-base tel quel.
```

## Mise à l'échelle

Déclarez la quantité produite par un module avec la clé de frontmatter `yields:`, et Gram met à l'échelle tout le module pour correspondre à ce que vous demandez réellement :

```gram
---
title: 'Pâte Sablée'
yields: 500g
---

## Pâte

Mélanger @farine{300g} avec @beurre{200g}.
```

Demander `&pate{250g}` sur cette base de 500g met à l'échelle chaque quantité du module par 0.5 — sans avoir besoin de l'option `--scale`. `yields:` accepte aussi un nombre discret (`yields: 24 cookies`, `yields: 1 tarte`).

Sans `yields:` déclaré, Gram mesure la masse propre du module pour calculer le facteur d'échelle, et signale le résultat comme une estimation (`ESTIMATED_MODULE_YIELD`) chaque fois que cette mesure elle-même repose sur une densité ou un poids unitaire estimé, plutôt que sur une masse réelle.

**Les bindings déstructurés se mettent à l'échelle ensemble, par export.** Chaque export lié est mesuré par rapport à son propre rendement, et si vous utilisez plusieurs bindings du même module avec des quantités différentes, c'est le ratio le *plus élevé* qui l'emporte pour tout le module (la même règle somme-au-sein-d'un-export / max-entre-exports que Gram applique déjà pour les [ingrédients composites](/fr/docs/reference/syntax/composite-ingredients)) :

```gram
@use "./bases/oeufs.gram" as { &blancs, &jaunes }

Monter &blancs{200g} et &jaunes{50g}.
```

Si `oeufs.gram` produit 100g de blancs et 50g de jaunes, `&blancs{200g}` exige que le module soit mis à l'échelle ×2 — ce qui produit alors 100g de jaunes contre les 50g réellement utilisés. Ce surplus est une information réelle, pas une erreur : Gram le signale (`MODULE_SURPLUS`) plutôt que de rejeter l'import.

**Les temps de cuisson et de repos ne sont jamais mis à l'échelle** — doubler une fournée de cookies ne réduit pas de moitié leur temps au four. Un nombre nu face à un rendement massique ou volumique (`&cookies{2}` face à un module `yields: 500g`) est interprété comme des *fournées* du module plutôt que comme une fraction de celui-ci, et Gram le signale explicitement (`MODULE_BATCH_INTERPRETATION`) puisque c'est le seul endroit du pipeline où « combien de fois faut-il refaire ceci » compte réellement. Au-delà de ce que votre équipement peut contenir en une fois, dupliquez les étapes à la main ou utilisez un [track nommé](/fr/docs/reference/syntax/times) pour sérialiser les fournées successives.

## Encapsulation

Les quantités relatives propres à un module (`@eau{70% @&farine}`) et les vérifications de dépendances entre ingrédients ne se résolvent que par rapport *aux sections de ce module lui-même* — une recette hôte qui utilise `@farine` pour tout autre chose ne fuite jamais dans les calculs propres d'une base, et réciproquement. C'est exactement la même règle de portée par section que Gram applique déjà au sein d'un seul fichier ; importer un autre fichier ne change rien à cela.

Un module qui n'est qu'une simple suite d'étapes, sans `## titre` propre, obtient malgré tout sa propre section une fois intégré — il ne se fond jamais dans la section sans titre de l'hôte.

## Ce qui ne se propage pas

Intégrer les sections d'un module ne fusionne pas son frontmatter avec celui de l'hôte. `title`, `description`, `author`, `source`, `tags`, `category`, et toute autre clé informationnelle appartiennent à la recette hôte elle-même — une base étiquetée `vegan` ne rend pas une tarte aux œufs et au beurre « vegan » simplement parce qu'elle importe cette pâte. Le frontmatter de l'hôte fait toujours autorité.

Deux exceptions :
*   `densities:` fusionne (la valeur de l'hôte l'emporte en cas de conflit).
*   `yields:` est lu pour calculer le facteur d'échelle, puis abandonné — il n'a plus de sens une fois qu'un module a été mis à l'échelle et intégré à autre chose.

La référence de pourcentage boulanger (`*`) propre à un module est retirée à l'import — le pourcentage boulanger pour « tarte plus pâte importée » n'a pas de sens cohérent, et Gram n'autorise déjà qu'un seul `*` par document.

## Mode prepared (boîte noire)

Par défaut, les étapes d'un module importé sont intégrées à la timeline — c'est tout l'intérêt de la fonctionnalité, pour une base dont le propre temps de repos ou passage au four doit s'entrelacer avec le reste. Parfois, ce n'est pas ce que vous voulez : un bouillon acheté tout prêt, ou une sous-recette dont le détail étape par étape encombrerait simplement le planning. Ajoutez `prepared` après les bindings pour l'importer comme une seule étape opaque à la place :

```gram
@use "./bases/bouillon.gram" as &bouillon prepared

## Soupe

Mijoter avec &bouillon{1L}.
```

Le module compte toujours pour l'ordonnancement et la liste de courses exactement comme il le ferait autrement — son propre temps actif/de repos mesuré devient la durée de cette unique étape, qui est donc toujours planifiée et entrelacée comme n'importe quelle autre étape, et ses ingrédients sont toujours ajoutés à la liste de courses. Ce qui change, c'est que ses propres étapes internes n'apparaissent jamais dans la timeline : de l'extérieur, « préparer le bouillon » est un seul bloc de temps, pas une douzaine d'étapes individuelles se disputant de la place dans le diagramme de Gantt.

`prepared` ne peut pas se combiner avec le destructuring (`as { &a, &b } prepared`) — une seule étape synthétisée ne peut produire qu'un seul binding. Le faire est une erreur (`PREPARED_MULTI_EXPORT`) ; retirez `prepared` ou scindez l'import en deux.

## Prise en charge par l'éditeur

Le language server (VS Code, ou tout autre éditeur qui parle LSP) résout `@use` au fil de la frappe, pas seulement lors de l'exécution de la CLI :

*   Les diagnostics, l'aperçu en direct et la vue Gantt reflètent tous la recette composée — y compris la mise à l'échelle du rendement d'une base importée. Une modification non sauvegardée dans une dépendance compte aussi, même ouverte dans un autre onglet, et même un changement effectué en dehors de l'éditeur (un `git pull`, un autre outil, une sauvegarde depuis une autre fenêtre).
*   Cette resynchronisation se propage à travers toute la chaîne d'imports : modifier une base profondément imbriquée rafraîchit tout fichier ouvert qui l'utilise (transitivement), et un problème à l'intérieur pointe directement vers le fichier et la ligne exacts plutôt que « quelque chose ne va pas quelque part dans vos imports ».
*   Aller à la Définition sur `&pate` saute dans le fichier de base lui-même, en atterrissant sur la section dont ce binding a réellement été exporté.
*   Taper `@use "` complète : `./`, `../`, `@/`, et tout alias `paths:` déclaré comme points de départ, puis les fichiers `.gram` et sous-répertoires réellement présents une fois le chemin engagé vers l'un d'eux.

## Limites (pour l'instant)

*   Il n'existe aucune bibliothèque officielle de recettes de base maintenue par Gram, et aucune n'est prévue — un hub communautaire de paquets (specifiers `hub:auteur/paquet`) est une idée à long terme, pas encore implémentée.

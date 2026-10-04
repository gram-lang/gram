---
title: "Planifier la mise en place : ingrédients, préparation et timing"
date: 2026-10-02
locale: "fr"
topic: "Devlog"
description: "Pourquoi Gram sépare ce dont une recette a besoin, le travail pour le préparer et le moment où on le fait, ce que la 1.4 a changé, et le nouveau planning par journée de travail pour les recettes sur plusieurs jours."
---

En terminant la 1.4, j'ai relu la nouvelle planification de la mise en place et quelque chose m'a gêné. Pas un bug, mais une confusion présente depuis le début : j'utilisais un seul mot, « préparation », pour trois choses différentes.

### Trois choses, pas une

Quand on lit une recette, on peut se poser trois questions distinctes :

- **De quoi ai-je besoin ?** Les listes d'ingrédients et la liste de courses.
- **Quel travail faut-il pour que ce soit prêt ?** Sortir, peser, éplucher, tailler. C'est la mise en place, et chaque section a son propre coût.
- **Quand est-ce que je fais ce travail ?** La chronologie, le temps total, le temps d'attente.

Les deux premières sont des faits sur la recette. Seule la troisième est un choix, et il appartient à celui ou celle qui cuisine : une même recette peut s'organiser de plusieurs façons selon la cuisine, l'équipe et la journée.

J'ai donc mis noir sur blanc une règle que Gram suivait déjà sans le dire : **choisir un planning ne change jamais les listes d'ingrédients, la liste de courses, le temps de préparation ni le temps actif.** Cela déplace seulement le travail sur la chronologie. La nouvelle page [Ingrédients, mise en place et planning](/docs/explanation/mise-en-place-and-planning/) l'explique avec un exemple détaillé.

### Ce que j'ai corrigé avant la 1.4

Le deuxième point concernait le planning « tout au début ». Il plaçait toutes les préparations tout au début, y compris la pesée d'un intermédiaire (`&pâte`), qui n'existe pas tant que la section qui le fabrique n'a pas eu lieu. Sur le papier c'était faux, et dans une vraie cuisine personne ne fait ça.

Désormais, un intermédiaire est toujours sorti juste avant la section qui l'utilise, dans tous les plannings. « Tout au début » devient un vrai mélange : les ingrédients bruts et le matériel d'abord, les intermédiaires au fur et à mesure qu'ils apparaissent. Rien ne change pour une recette sans intermédiaire.

### Travailler par sessions

Restait le cas que je n'avais pas résolu. Un professionnel ne planifie ni section par section, ni tout d'un coup : il travaille par **sessions**. Sur une recette en trois jours, on prépare chaque jour ce dont ce jour a besoin, pas forcément pour toutes les étapes de tous les jours. Et au cours d'une journée, certains intermédiaires n'existent qu'à ce moment-là.

La réponse que j'ai retenue n'ajoute aucune syntaxe : un troisième choix de lecture, **par journée de travail**. Les jours viennent de quelque chose que vous écrivez déjà, les ancres de rétroplanning :

- Une section ancrée à `~{-3d}` se travaille en J-3, une section à `~{-36h}` en J-1, et `~{-12h}` le jour même.
- Une section sans ancre prend le jour de la suivante, comme dans l'ordonnancement à rebours. Après la dernière ancre, c'est le jour même.
- Chaque journée commence par sa propre mise en place. Un intermédiaire fabriqué un jour précédent est sorti au début de la journée qui l'utilise ; celui qui est fabriqué le jour même attend juste avant la section qui l'utilise.

On obtient une feuille de production par jour. Une recette sans ancre d'un jour ou plus tient en une seule journée, et le planning est alors le même que « tout au début ». Rien à apprendre, rien à configurer, et cela s'ajoute à l'existant sans rien casser.

En l'essayant sur une tarte vanille en quatre jours, j'ai aussi appris quelque chose sur les ancres : deux sections d'une même journée dont l'une a besoin de l'autre ne peuvent pas être ancrées toutes les deux à `~{-1d}`, puisque chaque ancre est une échéance. Espacez-les (`~{-26h}`, puis `~{-25h}`) et elles restent toutes les deux en J-1. La page sur l'[ordonnancement ALAP](/docs/explanation/alap-scheduling/) le dit désormais.

### Essayez-le sur vos recettes

Si vous avez une recette qui se travaille sur plusieurs jours ou en plusieurs temps, essayez `gram view recette.gram --mise-en-place per-session`, ou le nouveau choix « Par journée de travail » du playground. Si cela ne correspond pas à votre façon d'organiser les jours, envoyez-la-moi : ce sont les vraies recettes qui me diront si les jours devraient venir d'ailleurs que des ancres.

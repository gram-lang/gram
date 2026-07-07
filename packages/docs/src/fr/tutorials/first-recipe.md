# Tutoriel : Votre Première Recette Complexe

À vos fourneaux ! Dans ce tutoriel, nous allons écrire une recette complète de **Tarte au Citron**.

Cette recette montre comment aller au-delà d'une simple liste d'ingrédients et utiliser les fonctionnalités avancées du compilateur Gram pour écrire une recette véritablement dynamique, scalable et orientée données.

## Étape 1 : Les Bases (La Pâte)

Commencez par définir la pâte sucrée. Le symbole `@` est utilisé pour les ingrédients et `#` pour le matériel (cookware).

::: code-group

```gram [Code]
## Pâte Sucrée

[Mixer] Dans un #robot multifonction{}, la @farine{180 g}, le @sucre glace{55 g}, et le @sel{1/4 c.à.c}.

[Sabler] Ajouter le @beurre{115 g}(froid, coupé en petits dés) et mélanger pendant ~{1-2 min} jusqu'à obtenir un mélange sableux.

[Incorporer] Ajouter l'@œuf{1}, l'@?extrait de vanille{1/2 c.à.c} et mélanger jusqu'à ce que la pâte forme une boule. 

[Repos] Envelopper de film alimentaire et laisser reposer au réfrigérateur pendant ~{1 h}.
```

```markdown [Aperçu]
### Pâte Sucrée

**Ingrédients** :
- **farine** (180 g)
- **sucre glace** (55 g)
- **sel** (1/4 c.à.c)
- **beurre** (115 g)
- **œuf** (1)
- **extrait de vanille** (1/2 c.à.c)

1. **[Mixer]** Dans un *robot multifonction*, la **farine** (180 g), le **sucre glace** (55 g), et le **sel** (1/4 c.à.c).
2. **[Sabler]** Ajouter le **beurre** (115 g) (froid, coupé en petits dés) et mélanger pendant ⏲️ 1-2 min jusqu'à obtenir un mélange sableux.
3. **[Incorporer]** Ajouter l'**œuf** (1), l'**extrait de vanille** (1/2 c.à.c) (optionnel) et mélanger jusqu'à ce que la pâte forme une boule.
4. **[Repos]** Envelopper de film alimentaire et laisser reposer au réfrigérateur pendant ⏲️ 1 h.
```
:::

Remarquez les tags `[Action]` au début de chaque ligne (ex : `[Mixer]`, `[Repos]`). Bien que ce ne soit pas strictement obligatoire, il est fortement recommandé de commencer chaque étape par son action principale entre crochets. Cela permet aux interfaces utilisateurs (UI) de générer des résumés clairs, étape par étape, de votre recette.

De plus, cette syntaxe est très lisible. Le compilateur va automatiquement extraire les ingrédients dans une liste de courses et sommer le temps actif (en supposant 2 minutes par étape par défaut) avec l'heure de repos.

## Étape 2 : Les Variables Intermédiaires

La pâte n'est pour l'instant qu'une liste d'étapes. Pour pouvoir l'utiliser plus tard (pour la cuire), il faut indiquer au compilateur que le résultat de cette section forme une entité unifiée.

On fait cela à l'aide d'une **Déclaration Intermédiaire** (`->&nom`) à la fin du titre de la section.

::: code-group

```gram [Code]
## Pâte Sucrée ->&pâte sucrée{}

[Mixer] Dans un #robot multifonction{}, la @farine{180 g}, le @sucre glace{55 g}, et le @sel{1/4 c.à.c}.

[Sabler] Ajouter le @beurre{115 g}(froid, coupé en petits dés) et mélanger pendant ~{1-2 min} jusqu'à obtenir un mélange sableux.

[Incorporer] Ajouter l'@œuf{1}, l'@?extrait de vanille{1/2 c.à.c} et mélanger jusqu'à ce que la pâte forme une boule. 

[Repos] Envelopper de film alimentaire et laisser reposer au réfrigérateur pendant ~{1 h}.
```

```markdown [Aperçu]
### Pâte Sucrée

**Ingrédients** :
- **farine** (180 g)
- **sucre glace** (55 g)
- **sel** (1/4 c.à.c)
- **beurre** (115 g)
- **œuf** (1)
- **extrait de vanille** (1/2 c.à.c)

1. **[Mixer]** Dans un *robot multifonction*, la **farine** (180 g), le **sucre glace** (55 g), et le **sel** (1/4 c.à.c).
2. **[Sabler]** Ajouter le **beurre** (115 g) (froid, coupé en petits dés) et mélanger pendant ⏲️ 1-2 min jusqu'à obtenir un mélange sableux.
3. **[Incorporer]** Ajouter l'**œuf** (1), l'**extrait de vanille** (1/2 c.à.c) (optionnel) et mélanger jusqu'à ce que la pâte forme une boule.
4. **[Repos]** Envelopper de film alimentaire et laisser reposer au réfrigérateur pendant ⏲️ 1 h.
```
:::

Désormais, dans la section suivante, cette pâte pourra être référencée en utilisant `&nom` au lieu de retaper tous les ingrédients. Le compilateur sait **qu'il ne faut pas ajouter la pâte à la liste de courses**, car il s'agit d'une préparation intermédiaire !

::: code-group

```gram [Code]
## Cuisson du Fond de Tarte

[Préchauffer] Préchauffer le #four{} à ^{180°C}.

[Étaler] Étaler la &pâte sucrée{} pendant ~{5 min} et la foncer dans un #cercle à tarte{}.

[Cuire] Pendant ~_{20 min} jusqu'à coloration dorée.
```

```markdown [Aperçu]
### Cuisson du Fond de Tarte

**Ingrédients** :
- 👉*pâte sucrée*

1. **[Préchauffer]** Préchauffer le *four* à 🔥180 °C.
2. **[Étaler]** Étaler la 👉*pâte sucrée* pendant ⏲️ 5 min et la foncer dans un *cercle à tarte*.
3. **[Cuire]** Pendant ⏳ 20 min (passif) jusqu'à coloration dorée.
```
:::

## Étape 3 : Minuteurs en Arrière-plan (Passifs)

À l'Étape 1, nous avions écrit : `[Repos] Envelopper de film alimentaire et laisser reposer au réfrigérateur pendant ~{1 h}`. 
Par défaut, les minuteurs sont **actifs**. Le compilateur suppose que vous attendez activement pendant 1 heure, et l'ajoute à votre *Temps Actif*.

Mais laisser reposer une pâte au réfrigérateur est une tâche passive. Vous pouvez faire autre chose pendant qu'elle repose (comme préparer le crémeux au citron). Pour indiquer au compilateur qu'il s'agit d'une tâche passive, on ajoute un underscore `~_` :

::: code-group

```gram [Code]
[Repos] Envelopper de film alimentaire et laisser reposer au réfrigérateur pendant ~_{1 h}.
```

```markdown [Aperçu]
1. **[Repos]** Envelopper de film alimentaire et laisser reposer au réfrigérateur pendant ⏳ 1 h (passif).
```
:::

Maintenant, le compilateur soustraira 1 heure de votre *Temps Actif* mais la gardera dans le *Temps Total*.

## Étape 4 : Ingrédients Composites

Une tarte au citron nécessite des zestes de citron et du jus de citron. Si vous écrivez `@zeste de citron{1 c.à.s}` et `@jus de citron{120 g}`, la liste de courses les considérera comme deux produits complètement différents. Or, on achète les citrons entiers !

Cela se résout avec les **Ingrédients Composites** (`<@parent`).

Voici la section du Crémeux au Citron :

::: code-group

```gram [Code]
## Crémeux au Citron

[Fouetter] Dans une #casserole{}, fouetter le @zeste de citron{1 c.à.s}<@citron, le @jus de citron{120 g}<@citrons{2}, le @sucre{150 g}, et les @œufs{3}.

[Cuire] Cuire à ^{feu moyen} pendant ~{8 min} jusqu'à épaississement.
```

```markdown [Aperçu]
### Crémeux au Citron

**Ingrédients** :
- **zeste de citron** (1 c.à.s)
- **jus de citron** (120 g)
- **sucre** (150 g)
- **œufs** (3)

1. **[Fouetter]** Dans une *casserole*, fouetter le **zeste de citron** (1 c.à.s), le **jus de citron** (120 g), le **sucre** (150 g), et les **œufs** (3).
2. **[Cuire]** Cuire à 🔥feu moyen pendant ⏲️ 8 min jusqu'à épaississement.
```
:::

Étant donné que le zeste et le jus pointent tous les deux vers `<@citron` (ou `<@citrons`), le compilateur comprend qu'il s'agit de différentes parties du même ingrédient parent. Plutôt que de s'en remettre à une base de données pour deviner les rendements, il applique la **Règle du MAX** : il regarde les quantités du parent nécessaires pour chaque partie distincte (`<@citron` vaut 1 par défaut pour le zeste, et `<@citrons{2}` vaut 2 pour le jus) et prend le maximum. Ici, puisque `max(1, 2) = 2`, la liste de courses va intelligemment réclamer exactement 2 citrons entiers !

## Étape 5 : Quantités Relatives

En pâtisserie, la précision est primordiale. Que se passe-t-il si vos citrons sont particulièrement dodus et donnent 140 g de jus au lieu des 120 g attendus ? Si la quantité de sucre était fixe, le crémeux deviendrait trop acide. Pour garantir que le crémeux soit parfaitement équilibré quel que soit le rendement réel du jus, le sucre doit s'ajuster dynamiquement pour représenter très exactement 125 % du poids du jus.

Vous pouvez utiliser les **Quantités Relatives** (`% @&cible`) :

::: code-group

```gram [Code]
[Fouetter] Dans une #casserole{}, le @zeste de citron{1 c.à.s}<@citron, le @jus de citron{120 g}<@citrons{2}, le @sucre{125% @&jus de citron}, et les @œufs{3}.
```

```markdown [Aperçu]
1. **[Fouetter]** Dans une *casserole*, le **zeste de citron** (1 c.à.s), le **jus de citron** (120 g), le **sucre** (150 g), et les **œufs** (3).
```
:::

À présent, le sucre est strictement lié au jus. Si vous ajustez la quantité de jus plus tard en fonction du rendement réel de vos citrons, le compilateur calculera automatiquement la masse exacte de sucre nécessaire (ici, 150 g) pour conserver le ratio parfait.

> **Note :** Pour approfondir la manière dont Gram gère les calculs relatifs complexes (comme l'utilisation de volumes ou d'unités comme cibles), consultez la référence sur les [Quantités Relatives](../reference/syntax/relative-quantities.md).

## La Recette Finale

Voici la recette complète. Remarquez à quel point elle reste propre et lisible, malgré l'incroyable quantité de logique qu'elle embarque !

::: code-group

```gram [Code]
---
title: Tarte au Citron Meringuée
portions: 8
---

## Pâte Sucrée ->&pâte sucrée{}

[Mixer] Dans un #robot multifonction{}, la @farine{180 g}, le @sucre glace{55 g}, et le @sel{1/4 c.à.c}.

[Sabler] Ajouter le @beurre{115 g}(froid, coupé en petits dés) et mélanger pendant ~{1-2 min} jusqu'à obtenir un mélange sableux.

[Incorporer] Ajouter l'@œuf{1}, l'@?extrait de vanille{1/2 c.à.c} et mélanger jusqu'à ce que la pâte forme une boule. 

[Repos] Envelopper de film alimentaire et laisser reposer au réfrigérateur pendant ~_{1 h}.

## Crémeux au Citron ->&crémeux

[Fouetter] Dans une #casserole{}, le @zeste de citron{1 c.à.s}<@citron, le @jus de citron{120 g}<@citrons{2}, le @sucre{125% @&jus de citron}, et les @œufs{3}.

[Cuire] À ^{feu moyen} pendant ~{8 min} jusqu'à épaississement.

## Cuisson du Fond de Tarte ->&fond cuit{}

[Préchauffer] Le #four à ^{180°C}.

[Étaler] La &pâte sucrée{} pendant ~{5 min} et la foncer dans un #cercle à tarte{}.

[Cuire] Pendant ~_{20 min} jusqu'à coloration dorée. Laisser refroidir.

## Assemblage

[Verser] Le &crémeux dans le &fond cuit{}. Réfrigérer pendant ~_{2 h}.
```

```markdown [Aperçu]
# Tarte au Citron Meringuée

> **Métadonnées**
> - **Temps Total** : 3h 44.5m
> - **Temps Actif** : 24.5m
> - **Temps de Préparation** : 20m (est.)
> - portions : 8

## 🛒 Liste de Courses

- **farine** (180 g)
- **sucre glace** (55 g)
- **sel** (1/4 c.à.c)
- **beurre** (115 g)
- **œuf** (1)
- **extrait de vanille** (1/2 c.à.c)
- **sucre** (125% du jus de citron)
- **œufs** (3)
- **citron** (2) **(Composite)** :
  - **zeste de citron** (1 c.à.s)
  - **jus de citron** (120 g)

## 🍳 Matériel

- *robot multifonction*
- *casserole*
- *four*
- *cercle à tarte*

## 👨‍🍳 Instructions

### Pâte Sucrée

**Ingrédients** :
- **farine** (180 g)
- **sucre glace** (55 g)
- **sel** (1/4 c.à.c)
- **beurre** (115 g) — froid, coupé en petits dés
- **œuf** (1)
- **extrait de vanille** (1/2 c.à.c)

1. **[Mixer]** Dans un *robot multifonction*, la **farine** (180 g), le **sucre glace** (55 g), et le **sel** (1/4 c.à.c).
2. **[Sabler]** Ajouter le **beurre** (115 g) (froid, coupé en petits dés) et mélanger pendant ⏲️ 1-2 min jusqu'à obtenir un mélange sableux.
3. **[Incorporer]** Ajouter l'**œuf** (1), l'**extrait de vanille** (1/2 c.à.c) (optionnel) et mélanger jusqu'à ce que la pâte forme une boule. 
4. **[Repos]** Envelopper de film alimentaire et laisser reposer au réfrigérateur pendant ⏳ 1 h (passif).

### Crémeux au Citron

**Ingrédients** :
- **zeste de citron** (1 c.à.s)
- **jus de citron** (120 g)
- **sucre** (125% du jus de citron)
- **œufs** (3)

1. **[Fouetter]** Dans une *casserole*, le **zeste de citron** (1 c.à.s), le **jus de citron** (120 g), le **sucre** (125% du jus de citron), et les **œufs** (3).
2. **[Cuire]** À 🔥feu moyen pendant ⏲️ 8 min jusqu'à épaississement.

### Cuisson du Fond de Tarte

**Ingrédients** :
- 👉*pâte sucrée*

1. **[Préchauffer]** Le *four* à 🔥180 °C.
2. **[Étaler]** La 👉*pâte sucrée* pendant ⏲️ 5 min et la foncer dans un *cercle à tarte*.
3. **[Cuire]** Pendant ⏳ 20 min (passif) jusqu'à coloration dorée. Laisser refroidir.

### Assemblage

**Ingrédients** :
- 👉*crémeux*
- 👉*fond cuit*

1. **[Verser]** Le 👉*crémeux* dans le 👉*fond cuit*. Réfrigérer pendant ⏳ 2 h (passif).
```
:::

### Qu'a fait le compilateur ?

En lançant `gram view tarte-citron.gram`, le compilateur s'est chargé de tous les calculs et du formatage à votre place :
- **Temps Actif** : ~24.5 mins (il ignore intelligemment les 3 heures de repos au frigo).
- **Temps Total** : ~3h 44.5 mins.
- **Liste de Courses** : Il a agrégé l'intégralité des ingrédients. Il a combiné l'`@œuf{1}` et les `@œufs{3}` en `4 œufs`. Il a calculé les citrons entiers nécessaires pour le zeste et le jus. Il a automatiquement converti la proportion relative de sucre en exactement `150 g` de sucre.

Vous venez d'écrire une recette ultra-scalable, orientée données !

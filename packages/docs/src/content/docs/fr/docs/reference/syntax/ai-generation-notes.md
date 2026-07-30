---
title: "Génération automatisée de Gram"
---

Cette page s'adresse à tout ce qui *génère* des fichiers `.gram` plutôt qu'à une personne qui les tape à la main — un script d'import, un scraper, ou un modèle d'IA qui convertit une recette existante (un site web, le scan d'un livre de cuisine, un objet JSON-LD) en Gram. La commande officielle `gram import` fournit au modèle d'IA qu'elle appelle un prompt système (`packages/cli/src/prompts/gram-spec.ts`) maintenu manuellement en synchronisation avec ces directives — considérez donc cette page comme la version publiée et lisible par un humain de ces mêmes instructions.

## Restructurer, ne pas transposer mot à mot

Le texte d'une recette traditionnelle contient de nombreuses étapes qui n'existent que parce que la prose n'a pas d'autre moyen de les exprimer. En Gram, la plupart d'entre elles se fondent directement dans la syntaxe au lieu de rester des étapes séparées :

- « Couper le citron en deux » → simplement `@citron{1}(coupé en deux)` sur l'ingrédient qui l'utilise.
- « Réserver l'assaisonnement » → simplement `&assaisonnement` lorsqu'il est référencé plus tard.
- « Mettre de côté et laisser refroidir » → simplement `~_{30min}` à la fin de l'étape qui le produit.

Un fichier `.gram` bien généré a souvent **moins d'étapes** que sa source, des frontières de section différentes, et un enchaînement logique différent — une recette source de 10 étapes peut tout à fait se compiler en 5 étapes Gram. Préserver le nombre d'étapes d'origine n'est pas un objectif ; la clarté, si. Pour chaque étape source, la question à se poser est : cette étape effectue-t-elle un vrai travail de cuisine, ou n'existe-t-elle que pour poser une information que Gram peut exprimer directement dans la ligne (*inline*) ? Si c'est le second cas, il vaut mieux l'absorber dans l'ingrédient ou le minuteur qui l'utilise plutôt que d'en garder une étape à part.

## Une checklist de conversion

Pour transformer une recette existante en `.gram`, parcourir ces cinq points dans l'ordre évite la plupart des erreurs de structure :

1. **Structure** — Identifier les phases distinctes (pâte, garniture, sauce, montage…). Chaque phase avec sa propre liste d'ingrédients est une candidate pour une `## Section`. Tout ce qui doit être préparé à l'avance reçoit un délai de rétroplanning (voir [Structure du Document](./document-structure.md#retroplanning-ordonnancement)).
2. **Frontmatter** — Extraire `title`, `author`, `source`, `category`, `portions` et les dates depuis les métadonnées disponibles dans la source. Ne jamais inventer une valeur absente de la source.
3. **Ingrédients** — Lister chaque `@ingrédient` unique avec son nom complet et ses espaces (`"huile d'olive"`, pas `"huile-d-olive"`). Repérer ceux qui apparaissent plus d'une fois — la deuxième mention et les suivantes doivent utiliser `@&`. Préférer les unités du système international pour la précision, mais garder `c.à.s`/`c.à.c`/`tasse` pour les petites quantités quand c'est ainsi que la source les exprime. Pour une partie d'un ingrédient (jus, zeste, jaune…), prévoir la [syntaxe composite](./composite-ingredients.md) plutôt qu'une étape de préparation séparée.
4. **Étapes** — Écrire chaque étape comme un paragraphe avec un préfixe d'action `[Verbe]`, en insérant chaque `@ingrédient`, `#matériel`, `~minuteur` et `^température` au fur et à mesure qu'ils sont introduits. Utiliser les minuteurs passifs (`~_`) pour les attentes qui libèrent le cuisinier (four, repos, réfrigération, pousse) et les minuteurs actifs (`~`) pour tout ce qui occupe les mains. Si plusieurs minuteurs passifs doivent s'enchaîner (ex: cuisson en plusieurs étapes), donnez-leur le MÊME NOM (`~_cuisson{10m}` puis `~_cuisson{30m}`) pour les séquencer automatiquement sans impacter le temps actif du cuisinier.
5. **Relecture** — Avant de finaliser, vérifier les erreurs listées ci-dessous : noms en kebab-case, unités dans les accolades de matériel, `@&` manquant sur une mention répétée, déclarations `->&nom` redondantes, et étapes autonomes qui ne font que préparer un ingrédient pour une étape ultérieure.

## Erreurs courantes

Voici les erreurs les plus fréquentes dans les fichiers `.gram` générés automatiquement.

### Noms d'ingrédients en kebab-case

```gram
❌  @huile-d-olive{2 c.à.s}     →   ✅  @huile d'olive{2 c.à.s}
❌  @farine-de-ble{250g}        →   ✅  @farine de blé{250g}
```
Les noms d'`@ingrédient` en Gram sont de vrais mots avec des espaces, pas des slugs. Le kebab-case est un concept interne, propre à la base de données — jamais de la syntaxe.

### Noms multi-mots sans `{}`

```gram
❌  Ajouter le @jus de citron et mélanger.
✅  Ajouter le @jus de citron{} et mélanger.

❌  X @jus de citron|@vinaigre et remuer.
✅  X @jus de citron{}|@vinaigre{} et remuer.
```
Un nom `@ingrédient`/`#matériel` à plusieurs mots a toujours besoin de `{}` (ou `{quantité}` pour le matériel) comme délimiteur final — même sans quantité connue, utilisez des accolades vides `{}`. Il n'existe pas de forme sans accolades pour un nom multi-mots ; la forme sans accolades ne fonctionne que pour un seul mot (`@sel`, `#poêle`). Sans `{}`, seul le premier mot devient le nom et tout ce qui suit se transforme silencieusement en texte d'étape ordinaire — à l'intérieur d'une alternative (`|`), cela lève désormais une erreur de parsing claire au lieu de corrompre silencieusement le groupe.

### Unités dans les accolades de matériel

```gram
❌  #poêle{20cm}      →   ✅  #poêle(20cm)
❌  #bol{grand}       →   ✅  #bol(grand)
```
Les accolades du `#matériel` n'acceptent que des nombres entiers. Dimensions, matériaux et descriptions vont toujours entre parenthèses — voir [Matériel](./cookware.md).

### Texte libre là où un nombre est requis

```gram
❌  @sel{au goût}          →   ✅  @sel{}   ou   @sel
❌  @farine{environ 200g}  →   ✅  @farine{200g}
❌  ~{environ 10 minutes}  →   ✅  ~{10min}
```
Les quantités et les minuteurs ont besoin d'un vrai nombre (ou d'accolades vides pour « au goût ») ; un texte flou ne se parse pas.

### Utiliser `@&` dès la première occurrence

```gram
❌  @&beurre{200g}   (première apparition du beurre)
✅  @beurre{200g}    (première déclaration)
✅  @&beurre{50g}    (deuxième utilisation, dans une étape ultérieure)
```

### Confondre `@&` (ingrédient brut) et `&` (variable intermédiaire)

```gram
// le poulet a été déclaré via @poulet{4}, PAS comme variable intermédiaire
❌  Faire dorer le &poulet pendant ~{3min}.     // & suppose une variable intermédiaire qui n'existe pas
✅  Faire dorer le @&poulet pendant ~{3min}.    // @& = deuxième référence à un ingrédient brut

// la pâte a été produite par une étape se terminant par ->&pâte
❌  Étaler la @&pâte.                          // @& suppose un ingrédient de la liste de courses
✅  Étaler la &pâte.                           // & = référence à la variable intermédiaire déclarée
```
Voir [Variables Intermédiaires](./intermediate-variables.md) pour la distinction complète. Plus généralement, dès qu'une étape transforme un ingrédient en un nouveau produit référencé par son nom dans les étapes suivantes (« le poulet assaisonné », « la pâte »), le déclarer avec `->&nom` élimine cette ambiguïté.

### Des étapes autonomes qui ne font que préparer un ingrédient

```gram
❌  [Prép] Couper le @citron{1} en deux. Émincer finement une moitié pour la décoration.
    [Cuisson] Presser le jus de @citron{1/2} dans la poêle.

✅  [Cuisson] Presser le @jus<@citron{1}(coupé en deux, une moitié émincée pour la décoration) dans la poêle.
```
Toute étape dont l'unique but est « prendre X et lui faire Y avant la vraie étape » devrait être absorbée dans la référence de l'ingrédient de l'étape qui l'utilise réellement, via le raccourci de préparation `()` — ici elle se rattache au parent du composite (`<@citron{1}(...)`), puisque « coupé en deux » décrit le citron, pas le jus.

### La formulation « le jus/zeste/partie de » au lieu de la syntaxe composite

```gram
❌  le jus de @citron{1/2}   →   ✅  @jus<@citron{1/2}
❌  le zeste de @citron{2}    →   ✅  @zeste{1}<@citron{2}
```
Les [ingrédients composites](./composite-ingredients.md) gardent la liste de courses exacte (la règle de chevauchement : zeste + jus du même citron s'agrègent toujours en un seul citron) et suppriment le besoin d'une étape de préparation autonome.

### Des espaces autour de l'opérateur composite

```gram
❌  @zeste{1} < @citron{2}
❌  @zeste{1} <@citron{2}
✅  @zeste{1}<@citron{2}
```

### Rattacher la préparation d'un composite au mauvais côté

```gram
❌  @jus(coupé en deux, une moitié émincée pour la décoration)<@citron{1}    // dit que le JUS a été coupé en deux
✅  @jus<@citron{1}(coupé en deux, une moitié émincée pour la décoration)    // dit que le CITRON a été coupé en deux
```
L'enfant et le parent d'un composite peuvent chacun porter leur propre préparation `()`, de manière indépendante :
- **La préparation de l'enfant** se place juste après son propre nom (et sa quantité, le cas échéant).
- **La préparation du parent** se place juste après `<@nomParent{coûtParent}`.

Rattachez-la à l'élément que la préparation décrit réellement — « coupé en deux » s'applique au citron entier, pas au jus extrait. Les deux peuvent se combiner quand c'est réellement nécessaire : `@jus{150 ml}(filtré)<@citron{1}(coupé en deux)`.

### Un `->&nom` redondant quand le titre de section en déclare déjà un

```gram
❌ ## Mélange d'Épices ->&assaisonnement

   [Mélanger] Le @paprika{2 c.à.c} et le @sel{1 c.à.c}. ->&mix1   // FAUX : la section déclare déjà la sortie

✅ ## Mélange d'Épices ->&assaisonnement

   [Mélanger] Le @paprika{2 c.à.c} et le @sel{1 c.à.c}.           // aucune déclaration locale nécessaire
```
Un `->&nom` au niveau d'une section capture déjà la sortie de toutes les étapes qu'elle contient — voir [Variables Intermédiaires](./intermediate-variables.md#declaration-au-niveau-de-la-section).

### Un minuteur actif pour une cuisson passive

```gram
❌  Cuire au four pendant ~{45min}.        // suppose que le cuisinier reste occupé 45 minutes
✅  Cuire au four pendant ~_{45min}.       // le four fait le travail, le cuisinier est libre
✅  Pétrir pendant ~{10min}.               // le cuisinier EST occupé — un minuteur actif est correct ici
```

# Comment générer une Liste de Courses Hebdomadaire

Si vous utilisez Gram pour du *meal prep* ou du *batch cooking*, vous avez probablement plusieurs fichiers `.gram` éparpillés dans un dossier. 

Générer une liste de courses unique et consolidée à partir de multiples recettes est l'une des fonctionnalités les plus puissantes de Gram. Le compilateur `@gram-lang/kitchen` agrège intelligemment les ingrédients, fusionnant les quantités quand c'est possible.

## La commande `gram shop`

Utilisez la commande CLI `gram shop` et passez un chemin avec joker (un *glob pattern*) ciblant vos recettes.

```bash
# Cibler un dossier spécifique
gram shop "menus/semaine-1/*.gram"
```

### Que se passe-t-il pendant l'agrégation ?

1. **Correspondance des ID** : Le compilateur regroupe tous les ingrédients qui partagent le même ID de base (ex : toutes les occurrences de `@beurre`).
2. **Résolution des Alias** : Si votre base de données définit `beurre doux` comme un alias de `beurre`, Gram fusionnera de manière transparente `@beurre doux{50 g}` et `@beurre{50 g}` en une seule entrée de `100 g` sous la clé principale `beurre`.
3. **Normalisation des Unités** : Si une recette utilise `@lait{200 ml}` et qu'une autre utilise `@lait{1 tasse}`, l'analyseur utilise la base de données pour les normaliser (généralement en grammes, ou n'importe quelle unité d'affichage que vous avez configurée).
4. **Catégorisation** : La liste finale est triée par catégories culinaires (ex : *Produits Laitiers*, *Fruits & Légumes*, *Épicerie*) en se basant sur vos données issues de `ingredients.yaml`, ce qui facilite la navigation au supermarché.

## Mise à l'échelle par Lot

Vous pouvez mettre à l'échelle tout votre plan de repas d'un seul coup. Si vos recettes sont prévues pour 2 portions, mais que vous recevez 4 invités cette semaine, vous pouvez passer un multiplicateur d'échelle global :

```bash
gram shop "menus/semaine-1/*.gram" --scale 2
```

> **Note** : Lors de la mise à l'échelle de plusieurs fichiers à la fois, vous devez utiliser un multiplicateur numérique (`--scale 2`). Vous ne pouvez pas faire une mise à l'échelle par référence d'ingrédient (`--scale farine=500g`), car le compilateur ne saurait pas la farine de *quelle* recette cibler.

## Formats de Sortie

Par défaut, `gram shop` produit une liste magnifiquement formatée en ASCII, directement dans votre terminal. 

Cependant, vous pouvez l'exporter dans différents formats pour la partager avec votre famille ou l'intégrer à d'autres outils :

```bash
# Exporter en Markdown
gram shop "menus/*.gram" --format md --output liste-de-courses.md

# Exporter en JSON
gram shop "menus/*.gram" --format json --output liste-de-courses.json
```

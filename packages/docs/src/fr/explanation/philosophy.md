# C'est quoi Gram ?

Gram est un langage de balisage orienté données, pensé par et pour les développeurs.

La plupart des formats de recettes ne sont que des blocs de texte statiques. Gram propose une approche différente : il traite les recettes comme du **code**. Il prend vos instructions culinaires (lisibles par un humain) et les compile en un JSON structuré et prévisible.

## La Philosophie

Au fond, cuisiner est un algorithme. Une recette n'est qu'une fonction qui prend des ingrédients bruts et sort un plat fini. Gram a été construit avec cet état d'esprit.

J'ai toujours adoré l'idée d'écrire des recettes en texte brut, largement inspiré par des projets pionniers comme l'excellent [Cooklang](https://cooklang.org). C'est fantastique pour des recettes maison simples et rapides. Mais quand les choses se compliquent — comme des formules de pâtisserie avec de multiples préparations, le pourcentage du boulanger, ou des plannings un peu tordus — s'appuyer uniquement sur du langage naturel montre vite ses limites.

Gram tire également une profonde inspiration structurelle du célèbre site [Cooking for Engineers](http://www.cookingforengineers.com/) et de ses recettes tabulaires. Puisque Gram compile les recettes en un arbre JSON prévisible, la porte est grande ouverte pour développer à l'avenir des rendus visuels poussés, comme des diagrammes de Gantt ou des flux tabulaires.

J'ai créé Gram comme une alternative pour ces scénarios plus exigeants. Il introduit de la **logique relationnelle** et de **l'intégrité de données** dans la rédaction de vos recettes :

- **Variables Relationnelles** : Si vous préparez une pâte à l'étape 1, vous pouvez y faire référence comme à un ingrédient à l'étape 5, évitant ainsi les duplications.
- **Précision Physique** : Gram comprend la différence entre "le zeste d'un citron" et "le jus de 2 citrons", s'assurant que votre liste de courses agrège précisément "Acheter 2 citrons" au lieu de 3.
- **Contrats de Données Stricts** : En utilisant des tags explicites, Gram s'assure que les températures, temps, ingrédients et équipements ne soient jamais confondus par le parseur.

::: tip L'Approche Écosystème
Gram n'est pas juste une syntaxe ; c'est un écosystème complet pour construire des applications culinaires.
Si vous créez une application de recettes, un planificateur de repas ou un tableau de bord de cuisine, vous ne devriez pas avoir à parser du texte brut à la main. Le **Moteur Gram** transforme votre texte en un Arbre Syntaxique Abstrait (AST) riche, l'enrichit avec des propriétés physiques (comme la normalisation des masses et la nutrition), et génère une structure JSON sur laquelle vous pouvez vraiment vous appuyer.
:::

## Pensé pour les Développeurs

L'écosystème Gram fournit tout ce dont vous avez besoin pour traiter vos recettes comme des logiciels :
- **Parseur & Compilateur (`@gram/kitchen`)** : Aplatit les sous-recettes, résout les pourcentages du boulanger, et met à l'échelle les quantités dynamiques.
- **Analyseur Sémantique (`@gram/analyzer`)** : Gère l'analyse physique, le calcul des rendements (Yield) et la normalisation des masses grâce à votre base de données locale.
- **Language Server (LSP)** : Apporte un vrai support éditeur à vos recettes (autocomplétion, diagnostics, infobulles).
- **CLI (`@gram/cli`)** : Compilez, mettez à l'échelle, comparez vos versions et extrayez vos listes de courses directement depuis votre terminal.
- **Renderer (`@gram/renderer`)** : Générez instantanément du HTML Sémantique ou du Markdown à partir de votre JSON compilé.

## À quoi ça ressemble ?

Gram reste très lisible, mais introduit discrètement des structures de données puissantes. Voici un aperçu avec la recette classique des cannelés bordelais :

::: code-group

```gram [canneles.gram]
---
title: 'Cannelés'
portions: 10
---

## Appareil ~{-1d} ->&batter

[Mélanger] Dans un #cul-de-poule{}, combiner la @farine{300 g}, le @sucre{500 g}, et le @sel{3 g}. ->&ingrédients secs{}

[Chauffer] Dans une #grande casserole{}, amener le @lait{1 l}, le @beurre{100 g}, et la @gousse de vanille{1}(fendue et grattée) à °{85°C}. ->&lait chaud{}

[Mélanger] Verser le &lait chaud{} sur les &ingrédients secs{} en une seule fois. Fouetter vigoureusement.

[Incorporer] Ajouter les @jaunes d'œufs{6}<@œufs{6} et le @rhum{100 ml}.

[Repos] Couvrir de #film alimentaire{} au contact et réfrigérer pendant au moins ~&réfrigérateur{24 h}.
```

```json [Aperçu de la Sortie]
{
  "title": "Cannelés",
  "meta": { "portions": "10" },
  "metrics": {
    "totalTime": 1465,
    "totalMass": 2132,
    "nutrition": {
      "total": {
        "calories": 4927,
        "protein": 80.2,
        "carbs": 781.6
        // ...
      }
    }
  },
  "shopping_list": [
    {
      "id": "farine",
      "qty": 300,
      "unit": "g",
      "normalizedMass": 300,
      "conversionMethod": "physical"
    },
    // ...
    {
      "type": "composite",
      "id": "œufs",
      "qty": 6,
      "usage": [ { "id": "jaunes d'œufs", "qty": 6, "normalizedMass": 102 } ]
    }
  ],
  "sections": [
    {
      "title": "Appareil",
      "retro_planning": "-1d",
      "intermediate_preparation": "batter",
      "steps": [
        {
          "type": "step",
          "action": "Mélanger",
          "content": [
            "Dans un ",
            { "id": "cul-de-poule", "_usageId": "36", "fixed": false },
            ", combiner la ",
            { "id": "farine", "qty": 300, "unit": "g", "normalizedMass": 300 },
            // ... (suite de l'AST)
          ],
          "timings": { "start": 0, "end": 2, "activeDuration": 2 }
        }
        // ... (autres étapes)
      ]
    }
    // ... (autres sections)
  ]
}
```

:::

Remarquez comment l'étape `[Incorporer]` utilise `<@œufs{6}` ? Cette syntaxe *d'ingrédient composite* indique à Gram que vous n'utilisez que les jaunes, mais que la liste de courses doit correctement agréger les œufs entiers pour l'achat. Le tag de section `~{-1d}` met en place un rétro-planning par rapport à l'heure finale de cuisson, et `->&lait chaud{}` prépare une variable intermédiaire que vous pouvez verser plus tard.

Prêt à vous lancer ? Consultez le guide [Pour Commencer](./getting-started.md).

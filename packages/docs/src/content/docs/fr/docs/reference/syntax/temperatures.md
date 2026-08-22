---
title: "Températures"
description: "Définissez des ^températures exactes ou sémantiques en Celsius ou Fahrenheit, avec des noms pour les étapes clés."
---

Les `^températures` de cuisson se déclarent dans vos recettes via le symbole `^`.

Afin de couvrir aussi bien la rigueur d'une cuisson au four que la subjectivité d'un feu de cuisson, Gram distingue deux formats : les **Températures Exactes** et les **Températures Sémantiques**.

## Températures exactes

Les températures exactes doivent spécifier une valeur numérique assortie d'une unité valide : `C` ou `F` (insensible à la casse, avec ou sans le symbole degré `°`). Quelle que soit la graphie employée, le compilateur la normalise sous sa forme canonique (`°C`/`°F`) dans sa sortie.

```gram
Préchauffer le #four à ^{180C}.

Cuire à ^{350°F} jusqu'à ce que ce soit bien doré.
```

### Noms de température
À l'instar des `~minuteurs`, vous pouvez attribuer un nom spécifique à une `^température`. Une bonne pratique pour plus de clarté : cela permet aux outils (comme le CLI ou votre front-end) d'extraire et de mettre en valeur l'appareil à paramétrer en un clin d'œil.

```gram
Préchauffer le #four à ^four{180°C}.
```

## Températures sémantiques

Pour la cuisson sur le gaz ou toute autre instruction subjective (là où une mesure en degrés n'a aucun sens), passez par une `^température` sémantique. Le texte y est libre.

```gram
Cuire sur la ^plaque{feu vif} pendant ~{2 min}.

Baisser à ^{feu doux} et laisser mijoter.
```

:::note[Règles d'Analyse (Parsing)]
Dès que le compilateur Gram croise une `^température`, il inspecte le premier caractère entre ses accolades :
- S'il s'agit d'un chiffre, il la *parse* comme une Température Exacte et valide la conformité de l'unité.
- S'il s'agit d'une lettre, l'intégralité du contenu est traitée comme une chaîne Sémantique.
:::

## Gestion des erreurs

Seuls les degrés Celsius et Fahrenheit sont pris en charge (pas de Kelvin). Le compilateur s'assure de la robustesse des déclarations et émettra un *warning* en cas de format inattendu :

- **Unité manquante (*Missing Unit*)** : Si vous écrivez `^{200}` sans spécifier `C` ou `F`, le compilateur remontera `MISSING_UNIT`.
- **Unité invalide (*Invalid Unit*)** : Si vous accolez une unité non reconnue (ex : `^{200K}`), le compilateur remontera `INVALID_UNIT` et conservera la valeur brute telle qu'écrite.

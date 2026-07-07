# Températures

Vous pouvez définir des déclarations de `^température` dans vos recettes en utilisant le symbole `^`.

Gram prend en charge deux formats pour une `^température` afin de répondre à la fois aux exigences précises de la pâtisserie et aux instructions de cuisson subjectives sur le feu : les **Températures Exactes** et les **Températures Sémantiques**.

## Températures Exactes

Les températures exactes doivent spécifier une valeur numérique et une unité valide (`°C` ou `°F`).

```gram
Préchauffer le #four à ^{180°C}.

Cuire à ^{350°F} jusqu'à ce que ce soit bien doré.
```

### Noms de Température
Tout comme pour un `~minuteur`, vous pouvez attribuer un nom spécifique à une `^température`. C'est particulièrement utile pour la clarté, permettant aux outils (comme le CLI) ou aux interfaces d'affichage personnalisées d'extraire rapidement et de mettre en évidence les informations clés de l'étape en un coup d'œil (ex : quel appareil doit être réglé).

```gram
Préchauffer le #four à ^four{180°C}.
```

## Températures Sémantiques

Pour la cuisson sur le feu ou les instructions subjectives où une mesure exacte en degrés n'a pas de sens, vous pouvez utiliser des chaînes de caractères de `^température` sémantiques. Cela vous permet d'écrire des descriptions textuelles génériques.

```gram
Cuire sur la ^plaque{feu vif} pendant ~{2 min}.

Baisser à ^{feu doux} et laisser mijoter.
```

::: info Règles d'Analyse (Parsing)
Lorsque le compilateur Gram rencontre une `^température`, il vérifie si le contenu entre accolades contient une unité reconnue (`°C` ou `°F`).
- Si c'est le cas, il l'analyse comme une Température Exacte (en validant le nombre).
- Si ce n'est pas le cas, il traite l'ensemble du contenu comme une chaîne de texte Sémantique.
:::

## Gestion des Erreurs

Le compilateur valide les déclarations de `^température` et produira des avertissements spécifiques pour des températures exactes mal formées :

- **Unité Manquante** : Si vous écrivez `^{200}` sans spécifier `C` ou `F`, le compilateur avertit `MISSING_UNIT`.
- **Unité Invalide** : Si vous fournissez une valeur numérique avec une unité non reconnue (ex : `^{200°K}`), le compilateur avertit `INVALID_UNIT`.

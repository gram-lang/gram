---
title: "Du balisage texte au compilateur : de Cooklang à la naissance de Gram"
date: 2026-08-22
locale: "fr"
topic: "Devlog"
description: "Pourquoi le simple balisage de recettes a fini par montrer ses limites pour la cuisine technique, et comment Gram est devenu un véritable langage dédié (DSL)."
---

Quand j'ai commencé à m'intéresser à l'écriture de recettes en texte brut, je suis rapidement tombé sur [Cooklang](https://cooklang.org), créé par Alex Dubowski. Le concept est très séduisant : plutôt que d'enfermer ses recettes dans des applications fermées ou des bases de données rigides, on rédige en texte clair avec quelques annotations syntaxiques discrètes (`@farine{200%g}`, `#saladier{}`, `~{15%minutes}`) pour en extraire automatiquement quelques données utiles (ingrédients, matériel, temps...).

Pour des recettes du quotidien, cette approche fonctionne très bien. Mais à mesure que j'écrivais des recettes un peu plus complexes (notamment en pâtisserie ou en boulangerie), j'ai commencé à me heurter aux limites du simple balisage textuel. 

C'est ce qui m'a poussé à développer **Gram** : non pas pour remplacer Cooklang, mais pour explorer une approche différente, plus proche d'un compilateur et d'un petit langage dédié (DSL).

## Les limites du balisage pour les recettes complexes

Dès qu'une recette s'étale sur plusieurs étapes ou nécessite des sous-préparations, les instructions ressemblent davantage à un graphe de dépendances qu'à une simple liste linéaire. 

Quelques cas de figure précis et communs en cuisine m'ont amené à repenser la structure :

### 1. Les préparations intermédiaires

Dans une recette complexe, le résultat d'une étape (une pâte, une crème, un bouillon) sert souvent d'ingrédient pour l'étape suivante. 

Avec un balisage texte classique, on se retrouve face à un dilemme :
* Soit on nomme la préparation en texte libre, et les outils perdent le lien entre les étapes.
* Soit on réécrit les ingrédients de base à chaque étape, ce qui fausse totalement la liste de courses en risquant de multiplier les quantités.

Dans Gram, ces résultats intermédiaires deviennent des variables que l'on déclare au fil de l'eau (`->&pâte`) pour les réutiliser plus loin (`&pâte`), sans jamais dupliquer les ingrédients réels.

### 2. Les ingrédients composites

En pâtisserie, il est fréquent de monter 4 blancs d'œufs pour une meringue dans une étape, puis d'utiliser les 4 jaunes pour une crème dans la suivante. 

Si un outil extrait naïvement `@blancs d'œufs{4}` et `@jaunes d'œufs{4}`, la liste de courses pourra faire croire qu'il est nécessaire d'acheter 8 œufs entiers au lieu de 4. 

Gram introduit une relation composite (`@blancs d'œufs{4}<@œufs{4}`) qui permet au compilateur de comprendre l'origine de l'ingrédient et de compter 4 œufs entiers au total.

### 3. La réutilisation de bases (`@use`)

On ne réécrit pas nécessairement une recette de pâte sablée ou de fond de tarte à chaque fois qu'on prépare un dessert. 

Avec la directive `@use "pate-sablee.gram"`, Gram permet d'importer une recette externe. Lors de la compilation, il calcule la masse de la base et adapte automatiquement ses proportions en fonction de ce que demande le plat principal, tout en intégrant ses ingrédients dans la liste de courses globale.

### 4. L'optimisation du temps et le rétro-planning

En cuisine, le temps n'est pas linéaire. Une recette alterne en permanence entre des temps actifs (émincer, mélanger, pétrir) et des temps passifs (laisser lever une pâte, cuire au four, faire reposer au réfrigérateur).

Quand on cuisine, on ne reste pas inactif devant le four : on profite des 40 minutes de cuisson pour préparer la garniture ou faire la vaisselle. De même, si un dessert demande 12 heures de repos au frais (`## Pâte ~{-1d}`), le cuisinier a surtout besoin de savoir précisément à quelle heure commencer la veille pour que tout soit prêt au moment de passer à table.

Gram analyse ces contraintes pour construire une véritable chronologie : il imbrique automatiquement les tâches actives au cœur des temps d'attente passifs et calcule l'heure de début optimale de chaque étape (rétro-planning) pour que l'ensemble soit parfaitement synchronisé pour le service.

## Deux approches pour deux usages

En intégrant ces concepts, Gram s'est naturellement éloigné de la légèreté initiale de Cooklang. C'est un compromis assumé entre deux visions :

* **Cooklang propose une suite complète pour gérer et cuisiner ses recettes au quotidien :**  
  La syntaxe se concentre sur l'essentiel et reste très discrète à la lecture. Autour de ce format, Cooklang propose un écosystème d'usage très riche : éditeur de bureau (Cook Editor), applications mobiles avec synchronisation, serveur web auto-hébergé, importateur depuis le web et extensions pour de nombreux éditeurs de texte. Tout est pensé pour capturer, organiser et cuisiner facilement ses repas.

* **Gram se concentre sur la modélisation en graphe et le calcul :**  
  Gram est pensé comme un compilateur : il s'appuie sur une grammaire formelle, un arbre syntaxique (AST), un serveur LSP avec diagnostics sémantiques, un module d'analyse physique (masses, nutrition) et un moteur d'ordonnancement. L'écriture demande un peu plus de rigueur, mais elle permet de garantir l'intégrité relationnelle pour des formules complexes ou des applications logicielles.

## Un chemin qui ne fait que commencer

Cooklang a posé les bases d'une façon moderne d'écrire des recettes en texte brut et bénéficie aujourd'hui d'une communauté active et d'une suite d'outils particulièrement mature. 

Gram n'en est qu'au tout début de son histoire. Si les fondations du langage, du compilateur et de l'analyseur sont aujourd'hui solides, il reste encore un long chemin à parcourir pour développer un écosystème d'une telle ampleur. Mon objectif est de continuer à affiner la syntaxe, d'enrichir les fonctionnalités de calcul et d'outillage, et de voir progressivement une communauté s'emparer du projet — que ce soit pour concevoir de nouveaux visualiseurs (diagrammes de flux, frises chronologiques), des intégrations avec d'autres outils ou simplement partager des recettes techniques.

Les deux formats ont chacun leur raison d'être : la simplicité et l'écosystème éprouvé de Cooklang pour le carnet de cuisine du quotidien, et la structure relationnelle de Gram pour les passionnés de cuisine technique et les développeurs qui souhaitent traiter la recette comme du code.

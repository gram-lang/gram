---
title: "L'énigme des 7 minutes : pourquoi Gram planifie votre cuisine en « visites »"
date: 2026-11-19
locale: "fr"
topic: "Devlog"
description: "Comment 7 minutes d'écart ont conduit à supprimer les temps cachés du compilateur, remplacer le diagramme de Gantt et concevoir le plan de marche par visites."
---

*« Ma recette ne totalise que 54 minutes de minuteurs, pourtant Gram annonce 1 h 01. D'où sortent ces 7 minutes supplémentaires ? »*

Cette question posée sur Reddit (accompagnée d'une remarque sur une mise en place entassée au tout début) ressemblait à un banal souci d'arrondi. En inspectant le compilateur, le problème s'est révélé plus profond : le modèle temporel de Gram était déconnecté de la cuisine réelle.

Tirer ce fil a mené à une refonte complète dans [Gram 1.4.0](/fr/blog/2026-11-13-release-140/) : abandonner la vue Gantt, repenser le temps autour du **plan de marche** par visites et isoler l'ordonnancement dans `@gram-lang/scheduler`.

## L'énigme des 7 minutes : le piège de la boîte noire

Le message de cet utilisateur pointait deux incohérences liées :

1. **Le mystère des temps calculés** : d'où venaient ces 7 minutes fantômes qui allongeaient la recette alors qu'aucun minuteur ne les mentionnait ?
2. **L'incohérence d'organisation** : *« Dans ma recette `.gram`, mes ingrédients sont rangés proprement par section, ce qui suggère que je prépare ma garniture au moment d'attaquer la garniture. Mais dans votre planning, toute la mise en place est tassée au tout début (`t = 0`). Pourquoi devrais-je sortir mon beurre dès la première minute pour une étape qui a lieu bien plus tard ? »*

En regardant ce que faisait `kitchen` en coulisses, on tombait sur un cas classique d'**effet « boîte noire »** :

- Pour estimer la préparation, le compilateur ajoutait silencieusement une durée cachée (1 minute par ingrédient ou ustensile à sortir, et 2 minutes dès qu'une préparation manuelle comme *émincer des oignons* apparaissait).
- Comme la recette ne précisait pas *quand* faire ces gestes, tout était compacté au tout début.
- Or, dans la vraie vie, si vous émincez une garniture pendant qu'une pâte repose (ce qu'on appelle en cuisine le **temps masqué**), ces 7 minutes ne rallongent pas la recette. En les empilant à `t = 0`, avant même de toucher la pâte, l'algorithme allongeait artificiellement la durée globale.

Corriger le tir semblait simple : il suffisait de déplacer ces préparations juste avant chaque section. Mais cet ajustement a fait apparaître une limite plus fondamentale : **dès qu'on laisse le cuisinier choisir *quand* faire sa mise en place** (juste avant chaque section, tout au début, ou regroupée par journée), **la notion même d'un « temps total » unique figé dans la recette s'effondre mathématiquement**.

Une recette n'a pas de durée absolue. Sa durée dépend de l'organisation du cuisinier, et le compilateur devait cesser d'inventer des minutes implicites.

## La fausse bonne idée : la frise chronologique

Restait la question de l'affichage. Au début de Gram, le planning reposait sur un **diagramme de Gantt**. Sur un écran d'ordinateur, des barres horizontales pour le pétrissage, pour la cuisson et hachurées pour les temps de repos... ça avait pas mal de gueule. Ça donnait l'impression d'appliquer la rigueur de l'aérospatiale à une miche de pain au levain.

Sauf qu'à l'épreuve d'une vraie cuisine, dès qu'on place la mise en place au bon moment et qu'on travaille sur des recettes longues, le diagramme de Gantt devient un non-sens ergonomique :

1. **L'illusion du temps continu** : un Gantt est conçu pour des chaînes de montage où une barre d'attente représente une ressource bloquée. En cuisine, pendant qu'une brioche lève 8 heures au frais, le cuisinier s'en va. Il dort, il travaille, il vit sa journée. Dessiner une frise de 1 500 pixels de large pour 5 minutes d'action humaine et 12 heures de vide ne sert à rien.
2. **Le piège de l'échelle linéaire** : si vous placez 2 minutes de pesée de la garniture juste avant son étape du lendemain matin, l'échelle linéaire écrase complètement l'action. Ces 2 minutes deviennent un trait invisible d'un demi-pixel, coincé entre deux déserts nocturnes.
3. **Il répond aux mauvaises questions** : avec les mains pleines de farine, personne n'a envie de déchiffrer un axe des abscisses pour faire des soustractions de tête. En entrant dans sa cuisine, on veut savoir trois choses immédiates :
   - *« Qu'est-ce que je dois sortir sur mon plan de travail maintenant ? »*
   - *« Quelles sont mes étapes tout de suite ? »*
   - *« À quelle heure est-ce que je dois revenir ? »*

Visuellement efficace sur un écran, le Gantt devenait impraticable une fois le tablier noué. J'ai fini par le retirer des interfaces dans Gram 1.4 pour repartir de la réalité physique du plan de travail, en m'inspirant de l'organisation des professionnels en brigade.

## Penser la cuisine en « visites »

Comment pense-t-on réellement son temps quand on cuisine ? Une recette sur plusieurs heures ou plusieurs jours n'est pas un ruban temporel ininterrompu : c'est une succession de **visites courtes dans sa cuisine**.

- **Visite 1 (la veille au soir, 20 min)** : pétrir la pâte, lancer la première fermentation au frais.
- **Visite 2 (le lendemain matin, 15 min)** : façonner les pièces, préparer la garniture, lancer la deuxième pousse.
- **Visite 3 (le midi, 30 min)** : préchauffer, enfourner et servir.

Entre chaque visite, la cuisine est propre (enfin elle devrait l'être !), éteinte et vide.

Ce changement de perspective a donné naissance au **plan de marche** (*run sheet*), la vue qui remplace la frise linéaire dans Gram. Au lieu d'un graphe abstrait, le moteur génère d'abord une vue d'ensemble condensée, suivie d'une fiche de poste autonome par visite :

```text
SAM. 10  ▮ 21:40 – 22:00 Pâte
         ┆ Pâte : Pointer 14 h 30 min (8–16 h)
DIM. 11  ▮ 12:30 – 13:00 Cuisson
         ★ 13:00         Servir
```

Chaque visite (`▮`) est structurée en **trois temps limpides** pour le cuisinier :

1. **Mise en place** : uniquement ce qu'il faut sortir pour *cette* session (ingrédients à peser, matériel nécessaire, préparations précédentes à reprendre du frigo).
2. **Exécution** : les étapes numérotées à enchaîner tout de suite, avec leurs minuteries et températures réelles.
3. **En partant** : ce qui continue sans vous (*« Pâte : Pointer 14 h 30 min »*) et l'heure du prochain passage (*« Prochain passage : dimanche 12:30 »*).

Aucun temps fantôme, aucune barre horizontale de vide : chaque minute affichée correspond à un geste concret dans la visite en cours.

## Séparer la recette du calendrier avec `@gram-lang/scheduler`

Cette refonte a aussi mis en évidence une limite d'architecture : le compilateur `kitchen` essayait de tout faire à la fois. Il analysait la recette, mais il calculait aussi des plannings figés comme s'il connaissait votre emploi du temps.

Or, un fichier `.gram` ne connaît ni votre heure de dîner, ni vos horaires de sommeil, ni quand vous rentrez du travail.

Tout le calcul temporel a donc été extrait de `kitchen` vers un package dédié, `@gram-lang/scheduler`, avec une frontière stricte :

- **`kitchen`** compile la recette en un graphe neutre de tâches, de pistes d'équipement et de contraintes culinaires (*« pétrir, laisser pointer entre 8 h et 16 h, cuire 30 min »*), sans présumer de votre organisation.
- **`scheduler`** projette ce graphe dans votre vie réelle lorsque vous lui fournissez une heure de service et vos créneaux de disponibilité (`gram plan recette.gram --serve "2026-11-22 13:00" --available "08:00-22:00"`).

Ce découplage débloque une souplesse qui était impossible auparavant. Prenez une pâte dont la pousse tolère entre 8 et 16 heures (`~_{8-16h}`) pour un service le dimanche à 13 h, alors que vous dormez entre 22 h et 8 h. Avec la pousse minimale de 8 heures, il faudrait pétrir à 4 h 10 du matin. Plutôt que de vous réveiller en pleine nuit, l'ordonnanceur **étire automatiquement l'attente à 14 h 30** (dans les bornes exactes autorisées par la recette) pour placer le pétrissage le samedi soir à 21 h 40, juste avant de vous coucher.

De la même façon, parce que le graphe de la recette est indépendant de sa projection, vous pouvez choisir librement votre stratégie de mise en place (`per-section` par défaut, `upfront` tout au début, ou `per-day` par journée) sans jamais modifier le fichier `.gram`. Si vous voulez explorer ces options en détail, elles sont documentées dans le guide [Planification et plan de marche](/docs/explanation/planning/) et dans la fiche pratique [`gram plan`](/docs/how-to/plan-a-meal/).

## Pour conclure

Modéliser le temps culinaire est un sujet complexe et passionnant, justement parce qu'un langage dédié (DSL) gagne à éviter d'imposer des métaphores logicielles à un métier manuel. Cette version 1.4 pose, je l'espère, des fondations solides pour une gestion plus fine et ancrée dans le réel de la cuisine, avec pour objectif de simplement vous dire au bon moment : *« Sors ton beurre maintenant, façonne ta pâte, et on se retrouve à midi. »*

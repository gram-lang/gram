---
title: "Pourquoi Gram génère votre base d'ingrédients plutôt que d'en intégrer une"
date: 2026-08-16
locale: "fr"
topic: "Devlog"
description: "Pourquoi j'ai abandonné l'idée d'embarquer le CIQUAL ou l'USDA, et comment Gram en est venu à générer des bases d'ingrédients sur mesure à la demande."
---

Quand j'ai commencé à travailler sur Gram, je m'étais fixé un objectif initial "simple" : concevoir une syntaxe en texte brut, propre et lisible par un humain, pour rédiger des recettes de cuisine. À ce moment du projet, le calcul nutritionnel automatisé des recettes n'était pas vraiment dans mon viseur. Mais dès que j'ai commencé à partager le projet et reçu mes premiers retours, plusieurs personnes m'ont immédiatement demandé s'il était possible de calculer les calories et les macronutriments. J'ai trouvé l'idée plutôt judicieuse, j'ai donc décidé de m'y pencher.

Sur le coup, ça ne me semblait pas totalement hors de portée et j'étais assez intéressé d'explorer cette piste. En réalité, la gestion des données d'ingrédients et la garantie d'un niveau de qualité correct de ces mêmes données se sont révélées être l'un des aspects les plus frustrants du projet et un sujet que j'avais complètement sous-estimé au départ.

## Le réflexe naturel : « Fournir une base toute prête »

Ma première réaction a été celle de n'importe quel développeur : trouver une base de données officielle, l'embarquer avec la CLI, et passer à autre chose. La France a le CIQUAL, les États-Unis ont l'USDA FoodData Central, et il existe aussi OpenFoodFacts pour les produits industriels.

Début 2026, j'ai passé pas mal de temps à essayer de construire une base de référence centralisée pour Gram. L'idée était de fournir un catalogue clé en main avec des centaines (voire des milliers) d'ingrédients pré-renseignés. Il n'a pas fallu longtemps pour me rendre compte qu'avec cette approche j'allais droit dans le mur.

D'abord pour une simple question de bon sens pratique : embarquer des milliers d'entrées alourdit inutilement le projet alors que 95 % d'entre elles ne serviront probablement jamais dans les recettes écrites par un utilisateur. Et surtout, maintenir un tel catalogue précis à jour représente une charge de travail colossale pour un petit projet open-source.

Ensuite, et c'est le point le plus fondamental : un ingrédient « universel », ça n'existe pas. Le beurre AOP français tourne autour de 82 % de matière grasse, tandis que le beurre standard américain se situe plutôt à 80 %. La farine T45 française n'a ni la même densité ni le même taux de protéines que l'*all-purpose flour* américaine. Une entrée du CIQUAL est exacte en France, une entrée de l'USDA est exacte aux États-Unis. Aucune des deux n'est « la » véritable valeur du beurre ou de la farine. La seule vraie vérité, c'est le produit que vous avez dans votre frigo, avec la liste des ingrédients que vous pouvez lire sur son emballage.

## Les langues sont vivantes et personnelles

Contrairement aux langages de programmation généralistes où les mots-clés comme `function` ou `import` sont des termes stricts et figés en anglais, Gram est pensé pour être rédigé naturellement dans la langue de l'utilisateur. Après tout, c'est un langage de recettes conçu pour la prose naturelle.

Même au sein d'une même langue, chacun a sa propre façon de nommer les choses. Dans mes propres recettes, j'écris souvent « vanille liquide » même si « extrait de vanille » est plus académique. Si vous écrivez vos recettes dans un éditeur avec le serveur de langage (LSP) de Gram, taper `@van...` doit vous proposer une autocomplétion qui colle à vos habitudes de rédaction, sans vous forcer à retenir le nom officiel tiré d'une nomenclature administrative. Le matching statique par nom échoue dès lors que de vraies personnes commencent à écrire de vraies recettes.

À un moment donné, j'ai envisagé de proposer des fichiers YAML fournis par la communauté, téléchargeables par type de cuisine. Mais en y réfléchissant concrètement, l'idée s'est avérée être une fausse bonne piste. Les seuls ingrédients suffisamment universels pour ne poser aucun problème d'appellation ou de disparité régionale (comme l'eau, le sel ou le sucre blanc) sont précisément ceux que les modèles d'IA ou de simples heuristiques gèrent sans la moindre hésitation. Pour tout le reste (fromages régionaux, pièces de viande spécifiques, fruits et légumes locaux), les fichiers statiques échouent pour les mêmes raisons : variations de noms et réalités régionales.

## Inverser le modèle : du sur-mesure à la demande

J'ai donc fini par prendre le problème à l'envers : au lieu de contraindre vos recettes à rentrer dans les cases d'un gigantesque catalogue externe, Gram génère un fichier `ingredients.yaml` ultra-léger au cœur de votre projet, construit uniquement autour des ingrédients que vous utilisez réellement.

Je rappelle par ailleurs que gérer une base d'ingrédients est totalement optionnel dans Gram. La syntaxe et le rendu de recettes fonctionnent parfaitement sans cela. Disposer d'une base permet simplement de débloquer l'Analyzer, pour calculer les valeurs nutritionnelles ou encore gérer les conversions de densité (comme convertir 150 ml de miel en grammes).

En gardant cette base locale et "taillée" pour votre projet, vous obtenez un petit fichier d'environ 40 à 80 ingrédients. Elle reste légère, garde l'autocomplétion de votre éditeur propre et rapide, et respecte votre propre vocabulaire.

## Composer avec la réalité et la précision des données

La contrepartie évidente d'une base générée localement (et de l'utilisation de l'IA pour compléter les données manquantes), c'est la fiabilité des chiffres. Mais d'un point de vue pragmatique, à moins d'envoyer chaque plat cuisiné dans un laboratoire de chimie alimentaire, le calcul nutritionnel sur une recette reste toujours une approximation. L'eau s'évapore à la cuisson, la teneur en sucre des fruits évolue avec la saison, et le gras d'une viande varie d'une pièce à l'autre. Le but n'est pas de faire semblant d'avoir une précision chirurgicale au milligramme près, mais d'obtenir des repères cohérents et plausibles pour pouvoir comparer ses recettes et suivre ses repas sereinement.

Pour s'assurer que les estimations de l'IA restent cohérentes, j'ai voulu mettre en place plusieurs garde-fous dans la CLI plutôt que de traiter le modèle comme une boîte noire.

Quand `gram db sync` analyse vos recettes, la commande ne crée d'entrées que pour ce que vous avez réellement écrit. Si vous avez par exemple écrit `@carotte{}` dans une recette et `@carottes{}` dans une autre, `gram db lint` utilise l'IA comme un linter sémantique pour repérer les pluriels et les synonymes évidents, en vous proposant de les fusionner sous une entrée unique dotée d'alias déclarés.

Quand vous lancez `gram db enrich` pour renseigner les densités et macronutriments manquants, les réponses de l'IA sont d'abord bridées par des limites physiques strictes dans le code : les calories ne peuvent pas dépasser 900 kcal pour 100 g (le gras pur tournant autour de 900 kcal), et les densités doivent rester dans des plages plausibles. Le prompt s'appuie également sur des exemples de référence pour ancrer les ordres de grandeur (liquides, poudres, aliments à la pièce) et s'appuie sur des catégories culinaires standardisées comme vérités terrain.

La CLI déroule ensuite une revue interactive dans le terminal où vous pouvez vérifier chaque suggestion, modifier une valeur à la volée, l'accepter ou l'ignorer. Tout ce qui est accepté tel quel est annoté d'un commentaire `# [LLM]` dans `ingredients.yaml`, afin que vous sachiez toujours ce qui provient de l'IA et ce que vous avez vérifié vous-même.

Enfin, `gram db validate` effectue des vérifications de cohérence physique sur le fichier. La commande confronte les calories à la formule d'Atwater (environ 4 kcal/g pour les protéines et glucides, 9 kcal/g pour les lipides), s'assure que les sous-nutriments comme les sucres ne dépassent pas les glucides totaux, et vérifie que la densité d'un ingrédient reste cohérente avec sa catégorie culinaire.

## Garder le contrôle et perspectives futures

Bien entendu, rien ne vous oblige à utiliser l'IA. Si vous voulez des chiffres parfaitement exacts pour les produits que vous achetez d'habitude, il suffit de lire l'étiquette nutritionnelle sur l'emballage et de renseigner directement les valeurs dans `ingredients.yaml`. Toutes les opérations sur disque utilisent d'ailleurs des verrous et des écritures atomiques pour éviter toute corruption par le serveur de langage ou des processus concurrents.

À terme, ces bases locales permettent aussi aux recettes partagées de s'adapter au lieu où elles sont cuisinées. Si une recette rédigée en France avec du beurre français est consultée par quelqu'un aux États-Unis avec sa propre base locale, le profil nutritionnel reflétera le beurre américain. Cela me semble plus fidèle à la réalité que d'imposer les données d'un pays à un autre se trouvant à l'autre bout du monde.

Actuellement, Gram prend déjà en compte la langue du projet pour contextualiser les suggestions de l'IA, mais je réfléchis à ajouter une option de région ou de pays dans `config.yaml` pour coller encore plus finement aux habitudes locales. Je pense aussi à de meilleurs outils, dans la CLI ou via des interfaces front-end, pour rendre l'inspection et la gestion d'`ingredients.yaml` aussi fluide que possible.

## Pour conclure

Gérer des données d'ingrédients dans un langage de recettes est un sujet complexe, et il n'existe sans doute pas de solution parfaite. Mais permettre à chaque projet de maintenir sa propre petite base locale me paraît être un compromis bien plus sain et pérenne que de prétendre qu'une table globale peut convenir à toutes les cuisines et tous les cuisiniers.

Le workflow `gram db` est encore jeune et continuera d'évoluer. Si vous utilisez Gram, n'hésitez pas à me faire vos retours et à me dire comment il se comporte avec vos propres recettes et ingrédients !

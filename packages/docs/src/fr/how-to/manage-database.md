# Comment gérer une Base de Données d'Ingrédients

Gram utilise un fichier local `ingredients.yaml` pour stocker les données physiques et nutritionnelles des ingrédients que vous utilisez dans vos recettes. Le maintien de cette base de données permet aux fonctionnalités telles que la Standardisation des Masses, le Calcul des Rendements et l'Estimation Nutritionnelle de fonctionner parfaitement.

Ce guide explique le flux de travail (workflow) standard pour entretenir votre base de données à l'aide du CLI Gram.

## Le Workflow de la Base de Données

Le workflow recommandé se compose de trois étapes, à exécuter dans cet ordre précis :
1. **Sync** : Trouver les nouveaux ingrédients dans vos recettes.
2. **Lint** : Dédupliquer les pluriels et les synonymes.
3. **Enrich** : Utiliser l'IA pour compléter les données manquantes.

### 1. Synchroniser les Nouveaux Ingrédients

En écrivant de nouvelles recettes, vous utiliserez inévitablement des ingrédients qui ne sont pas encore dans votre base de données. Au lieu de les ajouter manuellement, laissez le CLI s'en charger.

```bash
gram db sync
```

Cette commande scanne tous les fichiers `.gram` de votre projet. Si elle trouve un ingrédient (ex : `@lait de coco{200 ml}`) qui n'existe pas dans `ingredients.yaml`, elle lui ajoutera une entrée vierge.

*Astuce : Le CLI utilise une recherche approximative (fuzzy matching) pour vous suggérer d'éviter les doublons s'il détecte une faute de frappe !*

### 2. Nettoyage et Déduplication (Linting)

Parfois, vous pourriez écrire `@œuf` dans une recette et `@œufs` dans une autre. Ou bien `@sugar` et `@sucre` si vous écrivez dans plusieurs langues.

```bash
gram db lint
```

Cette commande utilise l'IA configurée pour détecter les doublons sémantiques dans votre base de données. 
Si elle trouve `œuf` et `œufs`, elle vous demandera lequel conserver comme clé principale. Elle fusionnera ensuite l'autre dans la liste des `aliases` (alias) de la clé principale.

> **Astuce :** L'IA respecte la langue par défaut définie dans votre fichier de configuration `config.yaml`. Si elle fusionne des termes anglais et français, elle vous proposera intelligemment le terme dans votre langue préférée comme clé principale !

Désormais, écrire `@œufs` pointera automatiquement vers l'entrée de base de données `œuf`.

::: tip Ce n'est pas la même chose que la syntaxe d'alias `:` de la recette
Cette liste `aliases` est ce que l'agrégation de la liste de courses utilise pour regrouper les ingrédients entre les recettes. Elle n'a aucun rapport avec la syntaxe de renommage au niveau de la recette `@Vrai Nom:Nom d'Affichage` (voir [Syntaxe des ingrédients](../reference/syntax/ingredients.md)), qui ne fait que changer l'affichage d'un ingrédient dans le texte des étapes — elle n'affecte jamais le regroupement ni la liste de courses.
:::

### 3. Enrichir les Données

Maintenant que votre base de données contient des entrées propres et dédupliquées, vous devez renseigner leurs données physiques (densité, poids unitaire, rendement) et nutritionnelles (calories, macros). 

Faire cela manuellement est fastidieux. Gram peut faire appel à l'IA pour le faire à votre place par lots :

```bash
gram db enrich
```

Le CLI va récupérer les données nutritionnelles standards et les densités pour toutes les entrées incomplètes de votre base de données. 

Cette opération est complètement idempotente : elle ne remplira que les champs manquants et n'écrasera jamais les données que vous avez saisies manuellement.

## Valider votre Base de Données

Avant de valider (commit) votre fichier `ingredients.yaml` dans votre gestionnaire de versions, il est recommandé de le valider par rapport au schéma Gram pour s'assurer qu'il n'y a pas d'erreurs de formatage (comme des alias qui se chevauchent).

```bash
gram db validate --strict
```

## Partager et Fusionner des Bases de Données

Si vous travaillez en équipe, ou si vous souhaitez importer une base de données communautaire, vous pouvez fusionner un fichier YAML externe dans votre fichier local :

```bash
gram db merge ~/Downloads/community-db.yaml
```

En cas de conflits (par exemple, la base de données communautaire indique que le beurre contient 717 kcal, mais la vôtre indique 740 kcal), le CLI vous demandera de manière interactive comment les résoudre.

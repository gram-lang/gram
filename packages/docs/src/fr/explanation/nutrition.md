# Analyse approfondie : Estimation Nutritionnelle

Le paquet `@gram/analyzer` est capable de calculer automatiquement le profil des macronutriments et micronutriments de n'importe quelle recette. 

Cependant, parce que les données nutritionnelles sont très sensibles et ont un impact sur les choix diététiques, Gram adopte une **approche stricte et mathématiquement conservatrice** pour l'estimation de la nutrition. Cette page explique cette logique.

## Le Flux de Calcul

1. **Standardisation des Masses** : Avant qu'aucun calcul nutritionnel ne puisse avoir lieu, l'Analyseur doit d'abord convertir chaque ingrédient de la recette en une masse standard en grammes. (Voir [Standardisation des Masses](./mass-and-yield.md)).
2. **Recherche dans la Base de Données** : L'Analyseur interroge votre base de données `ingredients.yaml` pour le bloc `nutrition` de chaque ingrédient. Les valeurs de la base de données doivent toujours représenter les nutriments **pour 100 g** de l'ingrédient cru.
3. **Mise à l'Échelle Proportionnelle** : L'Analyseur met à l'échelle les valeurs pour 100 g de la base de données afin de correspondre à la masse réellement utilisée dans la recette.
4. **Agrégation** : Les valeurs mises à l'échelle pour tous les ingrédients sont additionnées pour calculer la Nutrition Totale de la Recette.
5. **Division par Portions** : Si le frontmatter de la recette définit `portions: 4`, la Nutrition Totale de la Recette est divisée par 4 pour fournir des données Par Portion.

## Rapport Transparent des Données Partielles

La philosophie la plus importante du moteur nutritionnel de Gram est : **ne jamais cacher l'estimation, mais ne jamais laisser l'utilisateur la prendre pour la vérité absolue.**

Si vous cuisinez un repas avec 10 ingrédients, et que seulement 9 d'entre eux ont des données nutritionnelles dans votre base de données, afficher silencieusement la somme de ces 9 ingrédients risquerait d'être lu comme un total complet et précis, alors qu'il sous-estimerait le contenu calorique réel.

Plutôt que de retenir purement et simplement le total, Gram l'affiche à côté des informations nécessaires pour juger de sa fiabilité :
- Le `total` (et `perPortion`, si `portions` est défini) est toujours calculé et renvoyé à partir de toutes les données disponibles — il n'est jamais masqué.
- Un ratio de `coverage` (couverture) est toujours inclus (ex : `0.9` pour "90 % des ingrédients ont des données"), calculé comme la part des ingrédients ayant une masse qui possèdent un bloc `nutrition`.
- Une liste `warnings` signale exactement quels ingrédients sont absents de la base de données, manquent de bloc `nutrition`, ou ont une masse non résolvable — ainsi la lacune est attribuable, et n'est pas juste une mise en garde floue.

Le moteur de rendu HTML de référence reflète cela directement : il affiche toujours le panneau de nutrition chaque fois qu'il y a des données (ou un avertissement) à montrer, avec un badge `Couverture : X %` à côté. Cela donne au cuisinier un chiffre véritablement utile immédiatement, tout en rendant clair d'un seul coup d'œil quelle part de la recette ce chiffre prend réellement en compte — plutôt que de remplacer une "estimation précise à 90 %" par rien du tout.

## Gestion des Modificateurs

Les modificateurs de syntaxe de Gram ont un impact sur les calculs nutritionnels de manières spécifiques :

- **Ingrédients Optionnels (`?`)** : Les ingrédients marqués comme optionnels (ex : `@?crème chantilly`) sont **exclus** des totaux nutritionnels de base. L'Analyseur suppose le profil diététique le plus conservateur.
- **Alternatives (`|`)** : Lorsqu'une recette propose des alternatives (ex : `@beurre{50 g} | @huile{40 g}`), l'Analyseur ne calcule la nutrition que pour la **première option (préférée)**. Il ne fait pas la moyenne entre elles.
- **Ingrédients Composites (`<@`)** : La nutrition d'un ingrédient composite est calculée purement à partir de ses enfants, chacun étant recherché indépendamment dans la base de données via son propre id (ex : `jus de citron` et `zeste de citron` sont deux entrées distinctes avec des macros différentes). Il n'y a pas de repli sur les données nutritionnelles propres du parent — si un ingrédient enfant n'a pas de bloc `nutrition`, il est traité comme n'importe quel autre ingrédient manquant : il contribue à l'avertissement `MISSING_MACROS` et diminue la `coverage`, plutôt que d'être estimé à partir de son parent.

# Rendu & Sortie (`@gram/renderer`)

Une fois qu'une recette a été analysée par `@gram/parser`, compilée par `@gram/kitchen`, et (optionnellement) enrichie par `@gram/analyzer`, elle est prête à être présentée à l'utilisateur.

Le paquet `@gram/renderer` prend cet objet JSON enrichi final et le transforme en un Markdown structuré ou en HTML sémantique.

## Formats de Rendu

Le moteur de rendu (renderer) prend en charge trois formats de sortie :

### 1. Markdown (`toMarkdown`)
Génère un Markdown standard qui inclut une liste de courses formatée, une section équipement, et des étapes clairement numérotées. C'est parfait pour publier des recettes sur des générateurs de sites statiques (comme VitePress ou Hugo) ou les sauvegarder dans une application de notes comme Obsidian.

### 2. HTML Sémantique (`toHTML`)
Génère un document HTML sémantique et autonome. Le moteur de rendu HTML est conçu avec une architecture d'**Inversion de Contrôle**, vous permettant d'injecter vos propres classes CSS personnalisées et icônes SVG pour correspondre au design system de votre application.

### 3. HTML pour Impression (`toPrintHTML`)
Génère un document `<!DOCTYPE html>` complet et autonome avec sa propre feuille de style d'impression intégrée (taille de page A4, gestion des sauts de page pour les sections) et un jeu d'icônes fixe — conçu pour être ouvert directement dans un navigateur et imprimé, sans dépendance externe pour la feuille de style ou les ressources. Contrairement à `toHTML`, il n'accepte pas de surcharges pour `icons`/`classes`, mais il prend en charge `formatDuration`, `formatFraction`, et `hideStepQty`.

## Exemple d'Utilisation

```typescript
import { toMarkdown, toHTML } from '@gram/renderer';

// En supposant que `recipe` soit la sortie de @gram/kitchen ou @gram/analyzer
const recipe = {
  title: "Crêpes Simples",
  metrics: { totalTime: 30, activeTime: 10 },
  shopping_list: [
    { id: "farine", qty: 200, unit: "g" }
  ],
  sections: [
    {
      title: "Préparation",
      steps: [
        { type: "text", value: "Tout mélanger au fouet." }
      ]
    }
  ]
};

// 1. Rendu Markdown simple
const markdown = toMarkdown(recipe);

// 2. Rendu HTML personnalisé avec icônes sur mesure (Inversion de Contrôle)
const html = toHTML(recipe, {
  icons: {
    clock: '<svg class="icon-clock">...</svg>',
    fire: '<svg class="icon-fire">...</svg>'
  },
  classes: {
    recipeTitle: "text-2xl font-bold custom-title",
    recipeMeta: "flex gap-2 text-gray-500"
  }
});
```

`RendererOptions` expose également `bakersReference`/`bakersMathOnly` (pour afficher les calculs en pourcentage du boulanger) et `hideStepQty` (pour omettre les quantités des ingrédients du texte des étapes spécifiquement — notez que cela n'a actuellement un effet que sur `toPrintHTML`, pas sur `toMarkdown`/`toHTML`).

## Fonctionnalités

- **Formatage des Fractions** : Convertit les décimales en chaînes de fractions lisibles pour des quantités de cuisine courantes (ex : `0.5` devient `"1/2"`, `0.33` devient `"1/3"`) pour une meilleure lisibilité dans des contextes culinaires. Ce sont des fractions en texte brut (`1/2`), pas un caractère unicode unique.
- **Échappement Intelligent** : Échappe automatiquement les entités HTML pour éviter l'injection XSS provenant du contenu des recettes généré par l'utilisateur.
- **Formatage de la Durée** : Convertit les nombres entiers de minutes bruts en chaînes lisibles par l'homme (ex : `90` devient `1 h 30 min`).
- **Pré-stylisation CSS** : Le paquet fournit une feuille de style `gram.css` avec le thème pour l'aperçu en direct (tokens clair/sombre pour chaque type d'élément, ex : ingrédients, minuteurs). La feuille de style d'impression dédiée utilisée pour `toPrintHTML` est une feuille de style intégrée séparée — vous n'avez pas besoin de charger un fichier CSS vous-même pour utiliser la sortie d'impression.

## Consommation Directe du JSON

Si vous construisez une application web moderne (ex : utilisant React, Vue ou Svelte), vous **n'avez pas l'obligation** d'utiliser `@gram/renderer`.

La sortie JSON de `@gram/analyzer` est structurée et vous pouvez itérer dessus directement — mapper sur `recipe.sections` et `recipe.shopping_list` couvre les cas les plus courants. Gardez à l'esprit que des recettes plus riches peuvent produire des formes plus variées qu'il vaut la peine de traiter explicitement, telles que les alternatives/groupes d'ingrédients, les ingrédients composites, ou les articles possédant `normalizedMass`, `purchasingMass`, et `bakersPercentage` — la propre logique de formatage de `@gram/renderer` est une bonne référence pour savoir comment traiter ces cas si vous construisez un consommateur personnalisé.

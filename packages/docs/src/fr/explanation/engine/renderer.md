# Rendu & Sortie (`@gram-lang/renderer`)

Une fois qu'une recette a été analysée par `@gram-lang/parser`, compilée par `@gram-lang/kitchen`, et (optionnellement) enrichie par `@gram-lang/analyzer`, elle est prête à être présentée à l'utilisateur.

Le paquet `@gram-lang/renderer` prend cet objet JSON enrichi final et le transforme en un Markdown structuré ou en HTML sémantique.

## Formats de Rendu

Le moteur de rendu (renderer) prend en charge quatre formats de sortie :

### 1. Markdown (`toMarkdown`)
Génère un Markdown standard qui inclut une liste de courses formatée, une section équipement, des étapes clairement numérotées, des notes de bas de page GFM (`[^1]`), des badges de masse brute, et une section nutritionnelle optionnelle (`## 🥗 Nutrition`). C'est parfait pour publier des recettes sur des générateurs de sites statiques (comme VitePress ou Hugo) ou les sauvegarder dans une application de notes comme Obsidian.

### 2. HTML Sémantique (`toHTML`)
Génère un document HTML sémantique et autonome. Le moteur de rendu HTML est conçu avec une architecture d'**Inversion de Contrôle**, vous permettant d'injecter vos propres classes CSS personnalisées et icônes SVG pour correspondre au design system de votre application.

### 3. HTML pour Impression (`toPrintHTML`)
Génère un document `<!DOCTYPE html>` complet et autonome avec sa propre feuille de style d'impression intégrée (taille de page A4, gestion des sauts de page pour les sections) et un jeu d'icônes fixe — conçu pour être ouvert directement dans un navigateur et imprimé, sans dépendance externe pour la feuille de style ou les ressources. Contrairement à `toHTML`, il n'accepte pas de surcharges pour `icons`/`classes`, mais il prend en charge `formatDuration`, `formatFraction`, et `hideStepQty`.

### 4. Diagramme de Gantt (`toGanttHTML` + `attachGanttInteractivity`)
Génère une vue chronologique interactive de la recette — étapes actives, minuteurs en tâche de fond, et compression des temps morts — sous forme de fragment HTML. Contrairement aux trois formateurs ci-dessus, ce n'est pas une simple fonction pure : `toGanttHTML` produit un balisage statique (sans état de mode horaire/vue compacte figé), et un appel compagnon `attachGanttInteractivity(container, options)` connecte les tooltips au survol et les contrôles de mode horaire/heure cible/vue compacte côté client, via de la délégation d'événements DOM plutôt que la traversée `RenderBackend` partagée. Voir la [Référence API](/fr/reference/api/renderer) pour le contrat complet de `GanttRenderOptions`/`GanttInteractivityOptions`.

## Traversée Unifiée (`RenderBackend`)

Sous le capot, les trois moteurs de rendu de documents (Markdown, HTML, Print HTML) délèguent leur travail à une fonction d'orchestration unique (`renderRecipe` dans `traversal.ts`) qui invoque une implémentation `RenderBackend` propre à chaque format. Cela garantit une parité structurelle totale entre ces formats — le titre, le bloc de métadonnées, la liste de courses, la section matériel, les instructions, les notes et le panneau nutrition sont parcourus strictement dans le même ordre, que la cible soit HTML, Markdown ou Print HTML. Le diagramme de Gantt produit une sortie de nature fondamentalement différente (une chronologie, pas un document) et ne passe pas par cette traversée.

## Exemple d'Utilisation

```typescript
import { toMarkdown, toHTML } from '@gram-lang/renderer';

// En supposant que `recipe` soit la sortie de @gram-lang/kitchen ou @gram-lang/analyzer
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

`RendererOptions` expose également `bakersReference`/`bakersMathOnly` (pour afficher les calculs en pourcentage du boulanger), `hideStepQty` (pour omettre les quantités des ingrédients dans le texte des étapes en ligne sur l'ensemble des formatteurs), et `renderId` (un préfixe pour les identifiants d'ancre des notes de bas de page, ex. `"note-1"` ; a une valeur fixe par défaut, à surcharger avec quelque chose d'unique — un slug de recette par exemple — lorsque plusieurs recettes sont rendues sur la même page, pour éviter les collisions d'identifiants).

## Fonctionnalités

- **Formatage des Fractions** : Convertit les décimales en chaînes de fractions lisibles pour des quantités de cuisine courantes (ex : `0.5` devient `"1/2"`, `0.33` devient `"1/3"`) pour une meilleure lisibilité dans des contextes culinaires. Ce sont des fractions en texte brut (`1/2`), pas un caractère unicode unique.
- **Échappement Intelligent** : les trois moteurs de rendu échappent le contenu généré par l'utilisateur (titres, noms d'ingrédients, texte des étapes, commentaires) avant de l'insérer. `toHTML`/`toPrintHTML` échappent les entités HTML, donc leur sortie est sûre à insérer telle quelle dans une page. `toMarkdown` neutralise spécifiquement `<` et `&` (encodés en entités `&lt;`/`&amp;`, qui s'affichent comme des caractères littéraux dans n'importe quel lecteur Markdown) afin qu'une balise brute comme `<img src=x onerror=...>` dans un titre ou un nom d'ingrédient ne puisse pas survivre en HTML exécutable si vous convertissez ensuite ce Markdown en HTML.
  > [!WARNING]
  > Cet échappement neutralise le passthrough HTML brut (le vecteur XSS le plus courant avec les moteurs Markdown par défaut comme `markdown-it`/`remark`), mais `toMarkdown` ne fait pas de sanitization Markdown complète — un lien `[texte](javascript:...)` par exemple resterait tel quel. Si vous transformez la sortie de `toMarkdown()` en HTML à partir de sources non fiables (ex. fichiers `.gram` importés/partagés via `gram import`), assainissez tout de même le HTML final (ex. `rehype-sanitize`, DOMPurify) plutôt que de présumer la sortie entièrement sûre.
- **Formatage de la Durée** : Convertit les nombres entiers de minutes bruts en chaînes lisibles par l'homme (ex : `90` devient `1 h 30 min`).
- **Pré-stylisation CSS** : Le paquet fournit une feuille de style `gram.css` avec le thème pour l'aperçu en direct (tokens clair/sombre pour chaque type d'élément, ex : ingrédients, minuteurs) et une feuille de style `gantt.css` pour le diagramme de Gantt (chargée aux côtés de `gram.css`, jamais seule — elle réutilise ses tokens `--color-*`/`--gray-*`/`--gram-font-*` et son sélecteur de mode sombre). La feuille de style d'impression dédiée utilisée pour `toPrintHTML` est une feuille de style intégrée séparée — vous n'avez pas besoin de charger un fichier CSS vous-même pour utiliser la sortie d'impression.

## Consommation Directe du JSON

Si vous construisez une application web moderne (ex : utilisant React, Vue ou Svelte), vous **n'avez pas l'obligation** d'utiliser `@gram-lang/renderer`.

La sortie JSON de `@gram-lang/analyzer` est structurée et vous pouvez itérer dessus directement — mapper sur `recipe.sections` et `recipe.shopping_list` couvre les cas les plus courants. Gardez à l'esprit que des recettes plus riches peuvent produire des formes plus variées qu'il vaut la peine de traiter explicitement, telles que les alternatives/groupes d'ingrédients, les ingrédients composites, ou les articles possédant `normalizedMass`, `purchasingMass`, et `bakersPercentage` — la propre logique de formatage de `@gram-lang/renderer` est une bonne référence pour savoir comment traiter ces cas si vous construisez un consommateur personnalisé.

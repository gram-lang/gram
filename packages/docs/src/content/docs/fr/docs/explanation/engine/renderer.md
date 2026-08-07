---
title: "Rendu & Sortie (@gram-lang/renderer)"
description: "Comment @gram-lang/renderer transforme le JSON compilé en Markdown, HTML, impression et diagramme de Gantt."
---

Une fois la recette ingérée par `@gram-lang/parser`, compilée par `@gram-lang/kitchen`, et (idéalement) boostée par `@gram-lang/analyzer`, il ne reste plus qu'à l'afficher.

Le *package* `@gram-lang/renderer` embarque cet objet JSON complet pour le restituer en Markdown ou en HTML sémantique.

## Formats de Rendu

Le *renderer* supporte quatre exports :

### 1. Markdown (`toMarkdown`)
Génère un Markdown propre (GFM), incluant la liste de courses, le matos, des étapes numérotées, des notes de bas de page (`[^1]`), les badges de masse brute, et les macros nutritionnels (`## 🥗 Nutrition`). C'est l'export roi pour les générateurs de sites statiques (VitePress, Hugo, Astro) ou les apps de prise de notes (Obsidian).

### 2. HTML Sémantique (`toHTML`)
Génère un DOM HTML sémantique. L'export HTML repose sur l'**Inversion de Contrôle** : vous injectez vos propres classes CSS (coucou Tailwind) et vos SVG pour épouser le *Design System* de votre application.

### 3. HTML pour Impression (`toPrintHTML`)
Génère un `<!DOCTYPE html>` complet, *standalone*, armé de sa propre CSS d'impression intégrée (A4, sauts de page propres) et d'un set d'icônes SVG en dur. Conçu pour être ouvert dans un onglet et imprimé direct, sans le moindre appel externe. Contrairement à `toHTML`, vous ne pouvez pas écraser les `icons`/`classes`, mais les filtres classiques `formatDuration`, `formatFraction`, et `hideStepQty` restent supportés.

### 4. Diagramme de Gantt (`toGanttHTML` + `attachGanttInteractivity`)
Dessine la *timeline* interactive de la recette : étapes actives, *timers* passifs, et compression des temps morts (sous forme de fragment HTML). Contrairement aux trois autres cibles, c'est un travail en deux temps : `toGanttHTML` génère le balisage statique (sans présumer du mode d'affichage client), tandis qu'un helper `attachGanttInteractivity(container, options)` viendra brancher (côté navigateur) les événements, *tooltips*, et bascules de modes via délégation DOM. Jetez un œil à la [Référence API](/fr/docs/reference/api/renderer) pour maîtriser `GanttRenderOptions` et `GanttInteractivityOptions`.

## Traversée Unifiée (`RenderBackend`)

En interne, Markdown, HTML et Print HTML délèguent le traitement principal à un orchestrateur unique (`renderRecipe` dans `traversal.ts`). Ce dernier invoque l'interface `RenderBackend` de chaque formateur. Cette architecture garantit une parité absolue : titre, méta, liste de courses, matériel, étapes, notes et macros seront toujours parcourus dans cet ordre strict, quel que soit le format de sortie cible. Le Gantt fait figure d'exception, produisant un graphe et non un document.

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

// 2. Rendu HTML sur-mesure (Inversion de Contrôle)
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

L'objet `RendererOptions` offre aussi `bakersReference`/`bakersMathOnly` (pour les calculs de boulange), l'astucieux `hideStepQty` (pour expurger les quantités des phrases *inline*), ou encore `renderId`. Ce dernier préfixe les ancres HTML (ex: `"note-1"`) et s'avère indispensable (ex: avec un slug de recette) pour éviter les collisions d'ID si vous affichez plusieurs recettes sur la même page Web.

## Fonctionnalités

- **Formatage des Fractions** : Mue les horribles décimales en fractions de cuisine (`0.5` → `"1/2"`, `0.33` → `"1/3"`). Attention, ce sont de vraies *strings* ascii (`1/2`), pas des caractères unicode.
- **Échappement Malin** : Les formateurs échappent tous les contenus saisis par l'utilisateur. `toHTML`/`toPrintHTML` sont donc *safe* à injecter cash dans votre DOM. `toMarkdown` va jusqu'à assainir préventivement `<` et `&` (en `&lt;`/`&amp;`). Ainsi, si un petit malin glisse un `<img src=x onerror=...>` dans un titre, ce code malveillant ne s'exécutera pas quand vous compilerez ce Markdown pour le web.
  :::caution
  Même si cet échappement bloque les injections HTML vicieuses (le vecteur XSS classique via `markdown-it`/`remark`), `toMarkdown` ne purge **pas** tout. Un lien `[texte](javascript:...)` passera. Si vous rendez des `.gram` issus de sources douteuses, passez un coup de `DOMPurify` ou `rehype-sanitize` sur le HTML final par principe.
  :::
- **Formatage des Durées** : Transforme d'infâmes minutes brutes en temps humain (`90` → `1 h 30 min`).
- **Pré-stylisation CSS** : Le *package* *ship* un fichier `gram.css` embarquant le thème officiel (tokens clair/sombre par composant) ainsi qu'un `gantt.css` (dépendant du premier). Le Print HTML, lui, a sa propre CSS directement injectée dans son *header* : c'est *plug and play*.

## Consommation Directe du JSON

Si vous *buildez* une app frontend (React, Vue, Svelte), vous **n'êtes absolument pas forcé** d'utiliser `@gram-lang/renderer`.

Le JSON généré par `@gram-lang/analyzer` est typé et prêt à être itéré. Interroger directement `recipe.sections` et `recipe.shopping_list` conviendra dans la majorité des cas. N'oubliez pas les cas particuliers des recettes complexes (alternatives, composites, pourcentage du boulanger, `purchasingMass`). Si vous développez votre propre affichage, n'hésitez pas à consulter le code source de `@gram-lang/renderer` pour vous en inspirer.

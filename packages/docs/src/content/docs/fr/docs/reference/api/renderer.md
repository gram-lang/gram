---
title: "@gram-lang/renderer"
description: "Rendu des recettes compilées en Markdown, HTML, document prêt à imprimer, ou frise chronologique interactive (Gantt)."
---

Effectue le rendu d'un `CompilationResult` ou `AnalyzedCompilationResult` en Markdown, HTML, ou un document HTML autonome optimisé pour l'impression. Si vous construisez une UI personnalisée à la place (React, Vue, Svelte), vous n'avez probablement pas besoin de ce paquet du tout — consommez le JSON directement, voir [Créer une UI personnalisée](/fr/docs/how-to/build-custom-ui).

## `toMarkdown` / `toHTML` / `toPrintHTML`

```typescript
type RenderableCompilationResult = CompilationResult | AnalyzedCompilationResult;

function toMarkdown(data: RenderableCompilationResult, options?: RendererOptions): string
function toHTML(data: RenderableCompilationResult, options?: RendererOptions): string
function toPrintHTML(data: RenderableCompilationResult, options?: RendererOptions): string
```

```typescript
import { compile } from '@gram-lang/kitchen';
import { toHTML } from '@gram-lang/renderer';

const compiled = compile(ast);
const html = toHTML(compiled, { lang: 'fr' });
```

`toPrintHTML` retourne un document HTML complet et autonome (`<style>` inline, règles `@page` A4, aucune dépendance à une feuille de style externe) adapté aux fonctionnalités « imprimer cette recette » / export PDF — `toHTML` retourne un simple fragment destiné à être intégré dans une page existante.

Les trois formatteurs partagent une architecture de traversée unique (`RenderBackend`), garantissant que les résumés nutritionnels, les notes de bas de page, les badges de masse brute et les avertissements d'unités mixtes sont rendus de manière homogène en Markdown, HTML et Print.

### `RendererOptions`

| Option | Type | Description |
|---|---|---|
| `icons` | `RendererIcons` | Redéfinit tout sous-ensemble des glyphes d'icônes par défaut (voir `DEFAULT_ICONS` ci-dessous). |
| `classes` | `RendererClasses` | Redéfinit les noms de classes CSS sur les éléments générés (HTML/print uniquement). |
| `formatFraction` | `(value: number) => string` | Formateur décimal → fraction personnalisé (par défaut : fractions courantes comme `0.5` → `"1/2"`). |
| `formatDuration` | `(minutes: number) => string` | Formateur de durée personnalisé (par défaut : ex. `90` → `"1h 30m"`). |
| `hideStepQty` | `boolean` | Omet les quantités d'ingrédients dans le texte des étapes en ligne pour l'ensemble des formatteurs (la liste de courses et la mise en place ne sont pas affectées). |
| `bakersMathOnly` | `boolean` | N'affiche que les pourcentages boulanger, masquant les quantités absolues. |
| `interactiveScaling` | `boolean` | Affiche des contrôles interactifs de mise à l'échelle des portions/ingrédients (HTML uniquement). |
| `lang` | `string` | Code de langue (ex. `'en'`, `'fr'`) pour traduire les chaînes UI, via les dictionnaires de `@gram-lang/i18n`. |
| `renderId` | `string` | Préfixe pour les ids d'ancre de notes de bas de page — à redéfinir en cas de rendu de plusieurs recettes sur une même page pour éviter les collisions d'id. |

## Diagramme de Gantt (`toGanttHTML` & `attachGanttInteractivity`)

Génère une vue chronologique interactive sous forme de diagramme de Gantt pour offrir une représentation visuelle et temporelle précise de la recette (étapes actives, minuteurs en tâche de fond et planification du service).

```typescript
import { toGanttHTML, attachGanttInteractivity } from '@gram-lang/renderer';

// 1. Génère le fragment HTML statique
const ganttHtml = toGanttHTML(compiled, { lang: 'fr' });
container.innerHTML = ganttHtml;

// 2. Attache les événements interactifs et les tooltips au survol
const handle = attachGanttInteractivity(container, {
  timeMode: 'forward',   // 'forward' (chronomètre T+), 'reverse' (compte à rebours T-), ou 'target' (heure de service)
  targetTime: '19:30',   // Heure de service cible (HH:MM)
  isCompactMode: false   // Active ou désactive la vue compacte
});

// Met à jour dynamiquement les options
handle.setOptions({ isCompactMode: true });

// Nettoie les écouteurs d'événements au démontage du composant
handle.dispose();
```

### `GanttRenderOptions`

| Option | Type | Description |
|---|---|---|
| `lang` | `string` | Code de langue (ex. `'en'`, `'fr'`) pour traduire les chaînes UI via `@gram-lang/i18n`. |
| `gapThresholdMinutes` | `number` | Durée minimale d'inactivité en minutes avant d'appliquer la compression de la période d'attente (par défaut : `60`). |
| `compressedGapSize` | `number` | Largeur en minutes virtuelles à laquelle une période d'inactivité compressée est réduite (par défaut : `20`). |

### `GanttInteractivityOptions`

| Option | Type | Description |
|---|---|---|
| `timeMode` | `'forward' \| 'reverse' \| 'target'` | Mode d'affichage de l'axe temporel : temps écoulé (T+), compte à rebours (T-), ou heure réelle basée sur l'objectif de service. |
| `targetTime` | `string` | Heure de service cible au format `"HH:MM"`. |
| `isCompactMode` | `boolean` | Bascule le composant en vue compacte pour optimiser la hauteur verticale. |

## Icônes

```typescript
import { DEFAULT_ICONS, toHTML } from '@gram-lang/renderer';

const html = toHTML(compiled, {
  icons: { ...DEFAULT_ICONS.html, clock: '<svg class="my-clock-icon">...</svg>' },
});
```

`DEFAULT_ICONS` a deux variantes, `DEFAULT_ICONS.html` (balises `<i>` Phosphor) et `DEFAULT_ICONS.md` (emoji), chacune indexée par un sous-ensemble de `RendererIcons` : `hourglass`, `timer`, `thermometer`, `caretRight`, `arrowRight`, `arrowUDownLeft`, `warning`, `pencilSimple`, `minus`, `plus`. Les autres champs de `RendererIcons` (`clock`, `fire`, `knife`, `scales`, `clockCounterClockwise`, `arrowElbowDownRight`, `info`) ne font pas partie de `DEFAULT_ICONS` — `toHTML` utilise son propre balisage Phosphor codé en dur pour ceux-ci quand `options.icons` ne les redéfinit pas ; les redéfinir n'a donc d'effet que si on les passe directement via `options.icons`, pas via un spread de `DEFAULT_ICONS`.

## Utilitaires de formatage

Des helpers de plus bas niveau utilisés en interne par les trois formateurs, exportés pour construire des rendus personnalisés sur les mêmes conventions :

```typescript
function formatDecimalToFraction(value: unknown): string   // 0.5 -> "1/2"
function getQty(item: Record<string, unknown>): { value: number | string | null; text?: string; isRelative?: boolean } | undefined
function formatQuantityValue(q: any): string                // Quantité de minuteur/température -> chaîne d'affichage
function formatDuration(minutes: number): string            // 90 -> "1h 30m"
function escapeHtml(unsafe: string | null | undefined): string
function escapeMarkdownHtml(unsafe: string | null | undefined): string   // neutralise `<`/`&` pour un rendu Markdown vers HTML sûr en aval
function joinStepTokens(tokens: StepToken[], renderToken: (token: StepToken) => string, isSpaceable: (token: StepToken) => boolean): string
```

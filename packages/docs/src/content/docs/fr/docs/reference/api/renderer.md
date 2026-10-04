---
title: "@gram-lang/renderer"
description: "Rendu des recettes compilées en Markdown, HTML, document PDF-ready ou frise chronologique interactive (Gantt)."
---

Gère le rendu d'un `CompilationResult` (ou d'un `AnalyzedCompilationResult`) en Markdown, en HTML, ou en un document HTML autonome optimisé pour l'impression. Si vous construisez une interface front-end native (React, Vue, Svelte, etc.), vous n'aurez probablement pas besoin de ce *package* : vous consommerez le JSON directement. Voir [Créer une UI personnalisée](/fr/docs/how-to/build-custom-ui).

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

`toPrintHTML` génère un document HTML complet et autonome (`<style>` *inline*, règles `@page` A4, aucune dépendance externe), idéal pour des fonctionnalités « exporter en PDF » ou « imprimer la recette ». À l'inverse, `toHTML` retourne un simple fragment conçu pour s'intégrer discrètement dans une page existante.

Ces trois formateurs partagent un seul et même moteur de traversée sous le capot (`RenderBackend`). Cela garantit que les résumés nutritionnels, les notes de bas de page, les badges de masse brute ou les avertissements d'unités incompatibles seront rendus de manière parfaitement homogène, que vous cibliez du Markdown, du HTML ou du *Print*.

### `RendererOptions`

| Option | Type | Description |
|---|---|---|
| `icons` | `RendererIcons` | Surcharge tout ou partie des icônes par défaut (voir `DEFAULT_ICONS` ci-dessous). |
| `classes` | `RendererClasses` | Surcharge les noms de classes CSS appliquées aux éléments générés (HTML/print uniquement). |
| `formatFraction` | `(value: number) => string` | Fonction de formatage décimal → fraction personnalisée (par défaut, on gère les fractions courantes, ex : `0.5` → `"1/2"`). |
| `formatDuration` | `(minutes: number) => string` | Formateur de durée personnalisé (par défaut : ex. `90` → `"1h 30m"`). |
| `hideStepQty` | `boolean` | Masque purement et simplement les quantités d'ingrédients au sein du texte narratif des étapes, pour tous les formats (la liste de courses et la liste d'ingrédients de chaque section restent intactes). |
| `miseEnPlace` | `'perSection' \| 'upfront' \| 'perSession'` | *(Depuis la 1.4.0)* Où va la mise en place : juste avant chaque section (`'perSection'`, par défaut), tout au début (`'upfront'`) ou au début de chaque journée de travail (`'perSession'`). Pilote les temps total et d'attente dans l'en-tête. Avec `'perSection'`, le HTML affiche un libellé « Mise en place » sur la liste d'ingrédients de chaque section (la durée et le détail s'affichent au survol). Avec les deux autres, le HTML, le Markdown et l'impression ouvrent chaque session par un bloc « Mise en place » (étiqueté `J-3`, `J-1`, `Jour J`... quand la recette s'étale sur plusieurs jours), et le HTML ne garde un libellé sur une section que pour ce qui doit attendre, un intermédiaire fabriqué le même jour. Les listes d'ingrédients sont identiques dans les trois cas. Le planning est posé à partir des `tasks` de la recette. |
| `rests` | `'shortest' \| 'balanced' \| 'longest'` | *(Depuis la 1.4.0)* La durée d'un repos écrit en fourchette (`~_{12-24h}`) : le plus court (par défaut), le milieu ou le plus long. Un repos exact et un minuteur actif ne sont pas touchés. Pilote les mêmes temps que `miseEnPlace`. |
| `bakersMathOnly` | `boolean` | N'affiche que les pourcentages boulanger, masquant les quantités absolues. |
| `interactiveScaling` | `boolean` | Affiche des contrôles interactifs d'ajustement des portions/ingrédients (HTML uniquement). |
| `nutritionBasis` | `'auto' \| 'total' \| 'perPortion' \| 'per100g'` | Base nutritionnelle affichée. `'auto'` (défaut) montre le par-portion si la recette déclare des portions, sinon la recette entière. |
| `interactiveNutrition` | `boolean` | HTML uniquement : émet toutes les bases disponibles derrière un sélecteur en CSS pur, au lieu d'une seule. Nécessite la feuille de style du renderer ; ignoré si `nutritionBasis` fixe une base. |
| `lang` | `string` | Code de langue (ex. `'en'`, `'fr'`) pour traduire les chaînes UI, via les dictionnaires de `@gram-lang/i18n`. |
| `renderId` | `string` | Préfixe pour les ids d'ancre de notes de bas de page — à redéfinir en cas de rendu de plusieurs recettes sur une même page pour éviter les collisions d'id. |

## Diagramme de Gantt (`toGanttHTML` & `attachGanttInteractivity`)

Génère une chronologie interactive (diagramme de Gantt) pour offrir une représentation visuelle fidèle de la recette (étapes actives, temps d'attente en arrière-plan, etc.).

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
| `gapThresholdMinutes` | `number` | Durée minimale d'inactivité en minutes avant d'appliquer la compression de la période d'attente (par défaut : `60`). `Infinity` ne compresse jamais. |
| `compressedGapSize` | `number` | Largeur en minutes virtuelles à laquelle une période d'inactivité compressée est réduite (par défaut : `20`), sans jamais dépasser la durée de la période elle-même. |
| `miseEnPlace` | `'perSection' \| 'upfront' \| 'perSession'` | *(Depuis la 1.4.0)* Où va la mise en place (par défaut : `'perSection'`). La mise en place de chaque section est un bloc en pointillés à la couleur de la section, juste avant elle, tout au début ou au début de sa journée de travail ; avec `'perSession'`, un repère étiquette chaque jour. Le planning est posé à partir des `tasks` de la recette. |
| `rests` | `'shortest' \| 'balanced' \| 'longest'` | *(Depuis la 1.4.0)* La durée d'un repos écrit en fourchette (par défaut : `'shortest'`). |
| `projection` | `ProjectedPlan` | *(Depuis la 1.4.0)* La recette posée sur le calendrier par `project()` de `@gram-lang/scheduler`. Le graphique dessine les blocs du plan lui-même (un repos étiré ou raccourci apparaît à sa nouvelle longueur, entouré d'un contour pointillé, avec une note), lit son axe en vrais jours et heures du fuseau du plan, grise les heures où le cuisinier n'est pas disponible, et retire le sélecteur de mode de temps. `miseEnPlace` et `rests` sont alors ceux avec lesquels le plan a été fait, et sont ignorés ici. |

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

`DEFAULT_ICONS` propose deux variantes : `DEFAULT_ICONS.html` (éléments `<svg>` Phosphor autonomes intégrés en ligne) et `DEFAULT_ICONS.md` (emoji), couvrant toutes les deux l'intégralité des champs de `RendererIcons` (`hourglass`, `timer`, `thermometer`, `caretRight`, `arrowRight`, `arrowUDownLeft`, `arrowElbowDownRight`, `warning`, `pencilSimple`, `minus`, `plus`, `clock`, `clockCounterClockwise`, `fire`, `knife`, `scales`, `package`, `info`). Chaque icône peut être personnalisée individuellement via `options.icons`.

## Utilitaires de formatage

Une poignée d'utilitaires bas niveau (utilisés en interne par les formateurs) est exportée si vous avez besoin de bricoler vos propres rendus sur-mesure tout en respectant les conventions existantes :

```typescript
function formatDecimalToFraction(value: unknown): string   // 0.5 -> "1/2"
function getQty(item: Record<string, unknown>): { value: number | string | null; text?: string; isRelative?: boolean } | undefined
function formatQuantityValue(q: any): string                // Quantité de minuteur/température -> chaîne d'affichage
function formatDuration(minutes: number): string            // 90 -> "1h 30m" ; arrondi à la minute dès 1h, à la seconde en dessous (64.5 -> "1h 5m", 0.33 -> "20s")
function formatTimer(item: { quantity?: unknown; unit?: string | null }, separator?: string): string   // { quantity: 1, unit: "h" } -> "1h"
function toCommonFraction(value: number): string | undefined   // 0.25 -> "1/4", 0.3 -> undefined
function escapeHtml(unsafe: string | null | undefined): string
function escapeMarkdownHtml(unsafe: string | null | undefined): string   // neutralise `<`/`&` pour un rendu Markdown vers HTML sûr en aval
function joinStepTokens(tokens: StepToken[], renderToken: (token: StepToken) => string, isSpaceable: (token: StepToken) => boolean): string
```

## Fiche de production

*(Depuis la 1.4.0)* À partir du plan fabriqué par `project()` et de la recette compilée dont il est tiré, le moteur de rendu écrit la fiche de production en quatre formats, plus la fiche en mots pour fabriquer la vôtre :

```typescript
import { project, runSheet } from '@gram-lang/scheduler';
import { runSheetToText, runSheetToMarkdown, runSheetToHTML, runSheetToPrintHTML, describeRunSheet } from '@gram-lang/renderer';

const sheet = runSheet(project([{ graph: compiled.tasks }], context));

runSheetToText(sheet, compiled, { lang: 'fr' });      // texte brut
runSheetToMarkdown(sheet, compiled, { lang: 'fr' });  // Markdown
runSheetToHTML(sheet, compiled, { lang: 'fr' });      // un fragment, mis en forme par gram.css
runSheetToPrintHTML(sheet, compiled, { lang: 'fr' }); // un document complet, prêt à imprimer
const model = describeRunSheet(sheet, compiled);       // { title, servedAt, days: [{ heading, lines }], problems }
```

### `RunSheetRenderOptions`

| Option | Type | Description |
|---|---|---|
| `lang` | `string` | Code de langue (`'en'`, `'fr'`) pour les mots et les dates. |
| `roundTo` | `number` | Affichage seulement : une heure est montrée à ce nombre de minutes près (par défaut : `5`). Le calcul reste exact à la minute. |
| `formatDuration` | `(minutes: number) => string` | Formateur de durée personnalisé. |

Chaque ligne dit quand la tâche commence (« vers 21:40 »), ce que c'est, combien de temps elle dure et, pour un repos, jusqu'à quand. Une étape sans temps actif à elle est laissée de côté : le repos qu'elle démarre porte ce qu'elle dit. Chaque repos déplacé par le plan a une note, et ce qui n'a pas pu être arrangé est listé à la fin. Tout ce qui vient de la recette est échappé. La fiche couvre la première recette du plan.

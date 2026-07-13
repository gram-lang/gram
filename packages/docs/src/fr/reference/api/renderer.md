# @gram-lang/renderer

Effectue le rendu d'un `CompilationResult` ou `AnalyzedCompilationResult` en Markdown, HTML, ou un document HTML autonome optimisé pour l'impression. Si vous construisez une UI personnalisée à la place (React, Vue, Svelte), vous n'avez probablement pas besoin de ce paquet du tout — consommez le JSON directement, voir [Créer une UI personnalisée](/fr/how-to/build-custom-ui).

## `toMarkdown` / `toHTML` / `toPrintHTML`

```typescript
function toMarkdown(data: CompilationResult | AnalyzedCompilationResult, options?: RendererOptions): string
function toHTML(data: CompilationResult | AnalyzedCompilationResult, options?: RendererOptions): string
function toPrintHTML(data: CompilationResult | AnalyzedCompilationResult, options?: RendererOptions): string
```

```typescript
import { compile } from '@gram-lang/kitchen';
import { toHTML } from '@gram-lang/renderer';

const compiled = compile(ast);
const html = toHTML(compiled, { lang: 'fr' });
```

`toPrintHTML` retourne un document HTML complet et autonome (`<style>` inline, règles `@page` A4, aucune dépendance à une feuille de style externe) adapté aux fonctionnalités « imprimer cette recette » / export PDF — `toHTML` retourne un simple fragment destiné à être intégré dans une page existante.

### `RendererOptions`

| Option | Type | Description |
|---|---|---|
| `icons` | `RendererIcons` | Redéfinit tout sous-ensemble des glyphes d'icônes par défaut (voir `DEFAULT_ICONS` ci-dessous). |
| `classes` | `RendererClasses` | Redéfinit les noms de classes CSS sur les éléments générés (HTML/print uniquement). |
| `formatFraction` | `(value: number) => string` | Formateur décimal → fraction personnalisé (par défaut : fractions courantes comme `0.5` → `"1/2"`). |
| `formatDuration` | `(minutes: number) => string` | Formateur de durée personnalisé (par défaut : ex. `90` → `"1h 30m"`). |
| `hideStepQty` | `boolean` | Omet les quantités d'ingrédients dans le texte des étapes en ligne (la liste de courses et la mise en place ne sont pas affectées). |
| `bakersMathOnly` | `boolean` | N'affiche que les pourcentages boulanger, masquant les quantités absolues. |
| `interactiveScaling` | `boolean` | Affiche des contrôles interactifs de mise à l'échelle des portions/ingrédients (HTML uniquement). |
| `lang` | `string` | Code de langue (ex. `'en'`, `'fr'`) pour traduire les chaînes UI, via les dictionnaires de `@gram-lang/i18n`. |
| `renderId` | `string` | Préfixe pour les ids d'ancre de notes de bas de page — à redéfinir en cas de rendu de plusieurs recettes sur une même page pour éviter les collisions d'id. |

## Icônes

```typescript
import { DEFAULT_ICONS, toHTML } from '@gram-lang/renderer';

const html = toHTML(compiled, {
  icons: { ...DEFAULT_ICONS.html, clock: '<svg class="my-clock-icon">...</svg>' },
});
```

`DEFAULT_ICONS` a deux variantes, `DEFAULT_ICONS.html` (balises `<i>` Phosphor) et `DEFAULT_ICONS.md` (emoji), chacune indexée par les mêmes noms d'icônes que `RendererIcons` : `hourglass`, `timer`, `thermometer`, `caretRight`, `arrowRight`, `arrowUDownLeft`, `warning`, `pencilSimple`, `clock`, `fire`, `knife`, `scales`, `clockCounterClockwise`, `arrowElbowDownRight`, `info`, `minus`, `plus`.

## Utilitaires de formatage

Des helpers de plus bas niveau utilisés en interne par les trois formateurs, exportés pour construire des rendus personnalisés sur les mêmes conventions :

```typescript
function formatDecimalToFraction(value: unknown): string   // 0.5 -> "1/2"
function getQty(item: Record<string, unknown>): { value: number | string | null; text?: string; isRelative?: boolean } | undefined
function formatQuantityValue(q: any): string                // Quantité de minuteur/température -> chaîne d'affichage
function formatDuration(minutes: number): string            // 90 -> "1h 30m"
function escapeHtml(unsafe: string | null | undefined): string
```

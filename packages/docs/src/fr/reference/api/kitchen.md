# @gram-lang/kitchen

Le compilateur. Prend un `RecipeAST` (issu de `@gram-lang/parser`) et produit un `CompilationResult` : une charge JSON propre, structurée, prête au rendu — liste de courses, instructions par section avec minutages, un registre global d'ingrédients/matériel, et les éventuels avertissements structurels. Aucune base de données d'ingrédients n'intervient à cette étape ; c'est le travail de `@gram-lang/analyzer`.

## `compile`

```typescript
function compile(ast: RecipeAST, options?: CompilerOptions): CompilationResult
```

```typescript
import { getAST } from '@gram-lang/parser';
import { compile } from '@gram-lang/kitchen';

const ast = getAST(source);
const compiled = compile(ast);
// compiled.shopping_list, compiled.sections, compiled.metrics, compiled.warnings, ...
```

Lève une `Error` simple pour les violations structurelles qui ne peuvent pas être représentées comme un avertissement récupérable — ex : plus d'un ingrédient marqué avec le modificateur pourcentage boulanger (`*`).

### `CompilerOptions`

```typescript
interface CompilerOptions {
  scaleFactor?: number; // intègre un multiplicateur fixe dans la sortie compilée
}
```

### `CompilationResult`

```typescript
interface CompilationResult {
  title: string | null;
  slug: string | null;
  meta: Meta;                        // frontmatter parsé
  scaleFactor?: number;               // présent une fois une mise à l'échelle appliquée
  registry: {
    ingredients: Record<string, RegistryEntry>;
    cookware: Record<string, { id: string; name: string }>;
  };
  shopping_list: (ShoppingListItem | CompositeItem | Usage)[];
  cookware: Usage[];
  sections: ProcessedSection[];
  warnings: Warning[];
  metrics: {
    preparationTime: number; // temps de mise en place estimé (minutes)
    cookTime: number;        // durée du chemin critique (minutes)
    activeTime: number;      // somme du temps de travail actif (minutes)
    totalTime: number;       // preparationTime + cookTime
  };
}
```

Voir [Formats de Données](/fr/reference/api/data-formats) pour un exemple entièrement annoté de cette forme, et [Avertissements](/fr/reference/api/warnings) pour ce qui peut apparaître dans `.warnings`.

## Mise à l'échelle

Les recettes sont compilées à leurs quantités de base ; la mise à l'échelle est une étape séparée et composable afin que les appelants (ex : un curseur « portions » en temps réel dans une UI) puissent remettre à l'échelle sans re-parser ni recompiler.

```typescript
function resolveScaleFactor(
  compiled: CompilationResult | null,
  request: ScaleRequest,
  convertUnit?: UnitConverter,
): ScaleResolution

function applyScale(result: CompilationResult, factor: number): CompilationResult
```

`ScaleRequest` est soit un multiplicateur fixe, soit une quantité cible pour un ingrédient précis de la liste de courses, que `resolveScaleFactor` transforme en un unique `factor` :

```typescript
type ScaleRequest =
  | { type: "factor"; value: number }
  | { type: "target"; id: string; qty: number; unit: string | null };
```

```typescript
import { resolveScaleFactor, applyScale } from '@gram-lang/kitchen';

// « Je veux 300g de farine au total » -> dérive le multiplicateur depuis la liste de courses compilée
const { factor } = resolveScaleFactor(compiled, { type: 'target', id: 'farine', qty: 300, unit: 'g' });
const scaled = applyScale(compiled, factor);
```

`resolveScaleFactor` lève une sous-classe typée de `ScaleError` (chacune avec un `.code`) quand la requête ne peut pas être satisfaite : `InvalidFactorError`, `IngredientNotFoundError`, `NestedOnlyTargetError` (la cible n'existe qu'à l'intérieur d'une sous-recette composite), `AlternativeTargetError` (la cible est une option d'un groupe `@a|@b`), `FixedIngredientError` (marqué `@=` ou non numérique), `RelativeTargetError` (une quantité dérivée d'un `%`), `AmbiguousMultiUnitError` (utilisé avec des unités incompatibles dans la recette), `NonNumericTargetError`, `UnitMismatchError`.

`applyScale` est pure — elle ne mute jamais son entrée, si bien que le même `CompilationResult` peut être remis à l'échelle plusieurs fois de suite (ex : à chaque mouvement d'un curseur) sans effet cumulatif.

## Liste de courses & minutage (bas niveau)

`compile()` appelle déjà ces fonctions en interne ; elles sont exportées pour un usage avancé (ex : recalculer une liste de courses à partir d'un `ProcessedSection[]` construit sur mesure).

```typescript
function generateShoppingList(
  sections: ProcessedSection[],
  registry: Registry,
  options?: CompilerOptions,
): (ShoppingListItem | CompositeItem | Usage)[]

function calculatePreparationTime(sections: ProcessedSection[], registry: Registry): number
```

## `RecipeRegistry`

Le registre mutable d'ingrédients/matériel construit pendant la compilation, indexé par `slugify(name)`. Implémente l'interface `Registry` (`ingredients: Map`, `cookware: Map`, `warnings: Warning[]`).

```typescript
class RecipeRegistry implements Registry {
  registerIngredient(name: string, data?: Partial<Omit<RegistryEntry, "id" | "name">>): string; // retourne l'id
  registerCookware(name: string): string;                                                        // retourne l'id
  getIngredientId(name: string): string;
  toPlainObject(): { ingredients: Record<string, RegistryEntry>; cookware: Record<string, {...}> };
}
```

`RegistryEntry` porte `id`, `name`, et optionnellement `default_unit`, `is_composite`, `parent` (pour les enfants de sous-recettes composites), et `is_intermediate`.

## Avertissements

`CompilationResult.warnings` est un `Warning[]` — les problèmes structurels détectés pendant la compilation (références indéfinies, conflits de portée, unités de minuteur/température invalides, références circulaires...). Voir la [référence des avertissements](/fr/reference/api/warnings) pour la liste complète des codes, les sévérités, et les exports `WarningCode`/`pushWarning`.

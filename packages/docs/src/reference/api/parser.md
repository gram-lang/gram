# @gram-lang/parser

Turns `.gram` source text into a plain-object Abstract Syntax Tree (AST). This is the only stage of the pipeline that can fail on malformed input — every other package trusts that if it received an AST, it's structurally valid.

## `getAST`

```typescript
function getAST(input: string): RecipeAST
```

Parses a `.gram` source string and returns the root `RecipeAST` node. Throws a `GramParseError` on invalid syntax.

```typescript
import { getAST } from '@gram-lang/parser';

const ast = getAST(`
---
title: 'Crepes'
---

## Batter

Mix @flour{200g} and @milk{200ml}.
`);
```

## `GramParseError`

```typescript
class GramParseError extends Error {
  readonly offset: number;
  readonly expected: string;
}
```

Thrown by `getAST` on a syntax error.

| Field | Description |
|---|---|
| `message` | ohm-js's human-readable prose (source excerpt included) — safe to display directly. |
| `offset` | Plain character offset into `input` where the failure occurred. |
| `expected` | Description of what the parser expected at that offset. |

`offset` and `expected` are the portable, structured parts of the failure — useful for editor integrations (squiggly underlines, quick-fixes) that don't want to parse ohm's prose.

## AST node types

Every node has a `type: ASTNodeType` discriminant and an optional `loc: { start, end }` (character offsets into the source, present on most but not all node types — see the interfaces below).

<!--@include: ./parts/en/ast-node-types.md-->

## Key interfaces

```typescript
interface RecipeAST {
  type: ASTNodeType.Recipe;
  meta: Meta;              // Parsed frontmatter (title, date, tags, densities, ...)
  children: SectionAST[];
}

interface SectionAST {
  type: ASTNodeType.Section;
  title: string | null;
  retroPlanning?: string | null;       // e.g. "~{the day before}"
  intermediateDecl?: IntermediateDecl | null;
  children: (StepAST | CommentAST)[];
  loc?: Location;
}

interface StepAST {
  type: ASTNodeType.Step;
  action?: string | null;              // e.g. "Mix" from "[Mix] ..."
  children: (TextAST | IngredientAST | CookwareAST | TimerAST | TemperatureAST
    | ReferenceAST | AlternativeAST | IntermediateDecl | CommentAST)[];
  loc?: Location;
}

interface IngredientAST {
  type: ASTNodeType.Ingredient;
  name: string;
  modifiers: Modifier[];               // "optional" | "hidden" | "reference" | "bakers_percentage" | ...
  quantity: QuantityAST | RelativeQuantityAST | TextQuantityAST | null;
  alias?: string | null;
  preparation?: string | null;
  composite?: CompositeAST | null;     // set for "<@parent" composite ingredients
  loc?: Location;
}

interface QuantityAST {
  type: ASTNodeType.Quantity;
  value?: QuantityValueAST;            // { type: 'single' | 'fraction' | 'range' | 'text', value, ... }
  unit?: string | null;
  fixed: boolean;                      // true for the "@=" (never-scale) modifier
}

interface RelativeQuantityAST {
  type: ASTNodeType.RelativeQuantity;
  percent: number;
  target: string;
  referenceType: "variable" | "ingredient"; // "&name" vs "@name"
}
```

The remaining node interfaces (`CookwareAST`, `ReferenceAST`, `TimerAST`, `TemperatureAST`, `CommentAST`, `AlternativeAST`, `IntermediateDecl`, `TextQuantityAST`) follow the same pattern — see `packages/parser/src/types.ts` for the exhaustive list.

## Type guards

13 type guards are exported for safely narrowing `ASTNode | StepAST | ... | null | undefined` inputs without manual `.type` checks:

`isIngredient`, `isCookware`, `isTimer`, `isTemperature`, `isReference`, `isIntermediateDecl`, `isAlternative`, `isComment`, `isStep`, `isSection`, `isQuantity`, `isTextQuantity`, `isRelativeQuantity`.

```typescript
import { getAST, isIngredient, isTimer } from '@gram-lang/parser';

const ast = getAST(source);

for (const section of ast.children) {
  for (const step of section.children) {
    if (step.type !== 'Step') continue;
    for (const node of step.children) {
      if (isIngredient(node)) {
        console.log('Ingredient:', node.name);
      } else if (isTimer(node)) {
        console.log('Timer:', node.name, node.quantity);
      }
    }
  }
}
```

## Syntax highlighting: `@gram-lang/parser/textmate`

A subpath export ships the TextMate grammar used by the VS Code extension and the docs' own Shiki-powered code blocks:

```typescript
import gramGrammar from '@gram-lang/parser/textmate' with { type: 'json' };
```

It resolves to a `.tmLanguage.json` file — pass it straight into any TextMate-grammar-compatible highlighter (Shiki, Monaco, VS Code).

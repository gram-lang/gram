---
title: "@gram-lang/format"
description: "The canonical code formatter for .gram files, applying 13 deterministic formatting rules used by the CLI and editor tooling."
---

Canonical code formatter for `.gram` files, used by both the `gram format` CLI command and the VS Code extension / Language Server. It unifies 13 formatting rules into a single deterministic pass.

## `formatGram`

```typescript
function formatGram(source: string, options?: FormatterOptions): string
```

Formats a `.gram` source string according to Gram's 13 canonical formatting rules.

```typescript
import { formatGram } from '@gram-lang/format';

const formatted = formatGram(`
---
title: 'Crepes'
---

## Batter
Mix @flour{200g}  and  @milk{200ml}.
`);
```

## `FormatterOptions`

```typescript
interface FormatterOptions {
  tabSize?: number;      // Number of spaces per tab level (default: 2)
  insertSpaces?: boolean; // Use spaces instead of tabs (default: true)
}
```

## Formatting rules

`formatGram` applies 13 deterministic formatting rules:

1. **Frontmatter**: Preserves frontmatter delimiters (`---`) and cleans up leading/trailing whitespace around metadata.
2. **Section Headings**: Ensures a single space after `##` section titles (e.g. `## Section`).
3. **Step Indexing**: Formats numbered step prefixes cleanly (`1. Step text`).
4. **Action Blocks**: Formats step action prefixes (`[Mix] ...`).
5. **Ingredient Tokens**: Normalizes `@ingredient{qty}` spacing and bracket syntax.
6. **Cookware Tokens**: Normalizes `#cookware{qty}` spacing and bracket syntax.
7. **Timer Tokens**: Normalizes `~timer{duration}` and passive `~_timer{duration}` spacing.
8. **Temperature Tokens**: Normalizes `^temp{value}` syntax.
9. **Intermediate Declarations & References**: Normalizes `->&dough` declarations and `&dough` references.
10. **Composite Syntax**: Normalizes `<@parent` composite ingredient syntax.
11. **Decimal Quantities**: Normalizes numeric decimal quantities (e.g. trimming trailing zeros like `1.50` -> `1.5`).
12. **Comment Formatting**: Ensures clean spacing after comment sigils (`// comment`).
13. **Whitespace Cleanup**: Trims trailing whitespace per line and ensures a single trailing newline.

## `FormatterChanges`

Returns structured metrics on formatting edits made (useful for editor extensions and reporting):

```typescript
interface FormatterChanges {
  formatted: string;
  hasChanges: boolean;
  rulesApplied: string[];
}
```

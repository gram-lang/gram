# @gram-lang/format

[![npm version](https://badge.fury.io/js/@gram-lang%2Fformat.svg)](https://www.npmjs.com/package/@gram-lang/format)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

*Part of the [Gram monorepo](https://git.gram-lang.org/gram-lang/gram).*

Canonical `.gram` source code formatter, shared by the CLI (`gram format`) and Language Server (`format on save`).

---

## 📚 General Documentation

For full syntax specifications, command reference, and best practices, please refer to the **[Gram Documentation](https://docs.gram-lang.org/)**.

---

## 🛠️ Installation

```bash
npm install @gram-lang/format
# or
bun add @gram-lang/format
```

---

## ⚡ Usage

```typescript
import { formatGram, hasChanges, summarizeChanges } from '@gram-lang/format';

const unformatted = `
---
title: 'Crepes'
---
## Batter
Mix @flour{200g}  and  @milk{200ml}.
`;

const { content, changes } = formatGram(unformatted);

if (hasChanges(changes)) {
  console.log("Summary:", summarizeChanges(changes));
  console.log("Formatted content:\n", content);
}
```

---

## 🏗️ Structure & Rules

*   `src/index.ts`: Exports `formatGram`, `hasChanges`, and `summarizeChanges`.

The package enforces canonical formatting rules across `.gram` files (preserving frontmatter boundary integrity):
1. Lowercase ingredient IDs (`@Farine` → `@farine`)
2. Remove space between `@id` and `{` (`@ing {10g}` → `@ing{10g}`)
3. Trim spaces inside braces (`{ 10g }` → `{10g}`)
4. Remove trailing decimal zeros (`{500.0g}` → `{500g}`)
5. Normalize temperature unit spacing (`{180 °C}` → `{180°C}`)
6. Normalize composite ingredient separator spacing (`<@`)
7. Normalize arrow declaration spacing (`->&name{}`)
8. Normalize section header spacing (`## Header`)
9. Convert tabs to 4 spaces
10. Trim trailing whitespace line by line
11. Collapse consecutive blank lines to single blank lines
12. Ensure single newline at end of file

---

## 📄 License

This project is licensed under the GPL-3.0 License.

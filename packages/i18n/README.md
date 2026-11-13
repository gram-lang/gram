# @gram-lang/i18n

[![npm version](https://badge.fury.io/js/@gram-lang%2Fi18n.svg)](https://www.npmjs.com/package/@gram-lang/i18n)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

*Part of the [Gram monorepo](https://git.gram-lang.org/gram-lang/gram).*

The translation and normalization module of the Gram recipe language: it normalizes units and time, and holds every word a reader sees, in English and French (the renderer's views and the playground), plus the category labels and the AI language instructions. It provides high-performance, O(1) lookup dictionaries and normalizers to translate locale-specific aliases (e.g., `càs`, `cuillère à soupe`, `teaspoon`) into standardized canonical representation units (e.g., `tbsp`, `tsp`).

---

## 📚 General Documentation

For full syntax specifications, grammar details, cheatsheets, and best practices, please refer to the **[Gram Documentation](https://docs.gram-lang.org/)**.

---

## 🛠️ Installation

```bash
npm install @gram-lang/i18n
# or
bun add @gram-lang/i18n
```

---

## ⚡ Usage

The package exports two primary normalization functions: `normalizeUnit` (for volumes/masses) and `resolveTimeUnit` (for duration units).

```javascript
import { normalizeUnit, resolveTimeUnit } from '@gram-lang/i18n';

// 1. Normalizing measurement units
console.log(normalizeUnit('càs', 'fr'));            // 'tbsp' (French alias)
console.log(normalizeUnit('tablespoon', 'en'));      // 'tbsp' (English alias)
console.log(normalizeUnit('g'));                     // 'g' (Fallback / Global)

// 2. Normalizing time units
console.log(resolveTimeUnit('heures', 'fr'));       // 'h'
console.log(resolveTimeUnit('minutes'));            // 'm'
```

### Words and templates

`getDictionary(lang)` returns the dictionary of a language (`en` or `fr`): the labels of the renderer's views (`renderer.*`, including the names of the outputs and of the formats), the units of durations (`renderer.durationUnits`, `1h 30min` or `1j 1h`) and the strings of the playground. `fillTemplate(template, values)` fills the `{name}` placeholders of a dictionary string (`"Serve at {time}"` becomes `"Serve at 20:00"`) and leaves a name with no value as written, so a missing value shows up instead of vanishing.

```javascript
import { getDictionary, fillTemplate } from '@gram-lang/i18n';

const t = getDictionary('fr');
console.log(t.renderer.durationUnits);                       // { day: 'j', hour: 'h', minute: 'min', second: 's' }
console.log(fillTemplate('Serve at {time}', { time: '20:00' })); // 'Serve at 20:00'
```

A key is added in both languages together: a surface never carries a word of its own.

### ⚙️ How it Works

To maintain maximum performance under load (e.g., when compiling/analyzing large numbers of recipes), the dictionaries are compiled once at initialization into flat hash maps using `compileDictionary`. Lookups are `O(1)` operations.

If a language-specific code (e.g., `'fr'`) is provided, the function checks the locale dictionary first. If it cannot find the alias, or if no language is specified, it falls back to a global, unified dictionary mapping.

---

## 🏗️ Structure

*   `src/index.ts`: The main package entry point.
*   `src/dictionary.ts`: Dictionary compiler helper that transforms structured translations into flat `O(1)` maps.
*   `src/units.ts`: Mass and volume unit dictionary (French & English) and normalizer.
*   `src/time.ts`: Time unit dictionary (French & English) and normalizer.
*   `src/locales/`: The `en` and `fr` dictionaries (renderer views, nutrients, playground) and `getDictionary()`.
*   `src/template.ts`: `fillTemplate()`.
*   `src/categories.ts`: Shopping list category keys and their labels per language.
*   `src/ai.ts`: The language instruction added to AI prompts.

---

## 📄 License

This project is licensed under the GPL-3.0 License.

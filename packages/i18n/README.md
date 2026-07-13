# @gram-lang/i18n

The translation and normalization module for units and time within the Gram recipe language. It provides high-performance, O(1) lookup dictionaries and normalizers to translate locale-specific aliases (e.g., `càs`, `cuillère à soupe`, `teaspoon`) into standardized canonical representation units (e.g., `tbsp`, `tsp`).

---

## 📚 General Documentation

For full syntax specifications, grammar details, cheatsheets, and best practices, please refer to the **[Gram Documentation](https://gram-lang.org/)**.

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

### ⚙️ How it Works

To maintain maximum performance under load (e.g., when compiling/analyzing large numbers of recipes), the dictionaries are compiled once at initialization into flat hash maps using `compileDictionary`. Lookups are `O(1)` operations.

If a language-specific code (e.g., `'fr'`) is provided, the function checks the locale dictionary first. If it cannot find the alias, or if no language is specified, it falls back to a global, unified dictionary mapping.

---

## 🏗️ Structure

*   `src/index.ts`: The main package entry point.
*   `src/dictionary.ts`: Dictionary compiler helper that transforms structured translations into flat `O(1)` maps.
*   `src/units.ts`: Mass and volume unit dictionary (French & English) and normalizer.
*   `src/time.ts`: Time unit dictionary (French & English) and normalizer.

---

## 📄 License

This project is licensed under the GPL-3.0 License.

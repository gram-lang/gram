---
"@gram/analyzer": major
"@gram/language-server": patch
"@gram/playground": patch
---

**Breaking Change: Refactored Physical Engine Nomenclature**

The physical enrichment options and internal APIs have been renamed for clarity and to align with professional culinary terminology. 

If you are using `@gram/analyzer` programmatically, please update your configuration:
- `enableMassNormalization` is now **`enableMassStandardization`**
- `enableYieldManagement` is now **`enableYieldCalculation`**
- The exported `normalizeMass` helper is now **`standardizeMass`**

This update ensures total parity with the updated official documentation.

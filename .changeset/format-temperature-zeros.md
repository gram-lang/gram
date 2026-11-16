---
"@gram-lang/format": patch
---

**Format**: Fixed a temperature written with a space and trailing zeros, such as `^{160.0 °C}`, that took two runs of the formatter to become `^{160°C}`: it is now fixed in one.

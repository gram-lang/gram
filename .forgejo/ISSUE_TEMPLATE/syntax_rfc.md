---
name: Syntax proposal (RFC)
about: Propose a new language feature, grammar keyword, or AST modification
title: "[RFC]: "
labels:
  - rfc
  - needs-discussion
---

### Summary

A concise summary of the proposed syntax or language extension.

### Motivation & culinary use case

Why is this change necessary? What real-world recipe pattern, cooking technique, or workflow cannot be cleanly expressed today?

### Proposed syntax example

```gram
// Show how a recipe author would write this in a .gram file
```

### Compiler & tooling impact

How does this affect:
- **Parser & AST** (`packages/parser/grammar.ohm`)
- **Compiler / Kitchen** (`packages/kitchen`)
- **Language Server & Editor** (`packages/language-server`, TextMate grammar)
- **Formatting & Conformance tests** (`packages/format`, `conformance/`)

### Alternatives considered

What other syntax choices or approaches were evaluated, and why is this proposal preferred?

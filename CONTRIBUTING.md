# Contributing to Gram

Thank you for your interest in contributing to Gram. Gram is an open-source declarative recipe DSL and toolset designed to code recipes. Contributions of all kinds — bug reports, documentation improvements, syntax proposals, example `.gram` recipes, and code contributions — are welcome.

## Community & platforms

Primary development, issue tracking, and pull requests take place on the official Forgejo instance:

* **Official forge (Issues & PRs):** [git.gram-lang.org/gram-lang/gram](https://git.gram-lang.org/gram-lang/gram)
* **Mirrors (Read-only):** [GitHub](https://github.com/gram-lang/gram) and [Codeberg](https://codeberg.org/gram-lang/gram)
* **Community chat:** Join our Discord server to chat with other recipe hackers and maintainers.

## Getting started

Local development of the monorepo requires [Bun](https://bun.sh/) (v1.3+).

### Prerequisites and setup

1. Clone the repository and install dependencies:
   ```bash
   git clone https://git.gram-lang.org/gram-lang/gram.git
   cd gram
   bun install
   ```

2. Build all packages:
   ```bash
   bun run build
   ```

3. Start the development server for the documentation website and playground:
   ```bash
   bun run dev
   ```

### Architecture: the pipeline

Gram processes recipes through a five-stage pipeline where each package consumes the output of the previous stage:

1. **`parser`**: Parses `.gram` source via Ohm.js (`packages/parser/grammar.ohm`) and produces the raw AST.
2. **`modules`**: Resolves `@use` import directives and composes multi-file recipes into a unified AST.
3. **`kitchen`**: The compiler. Transforms the AST into structured compiled recipe JSON, resolves references (`&dough`), schedules operations (ALAP retro-planning), and emits warnings.
4. **`analyzer`**: The physical layer. Resolves mass standardization (volume to grams via `ingredients.yaml`), nutritional metrics, and recipe diffing.
5. **`renderer`**: Converts compiled JSON into HTML, Markdown, or timeline views.

### Repository structure

| Workspace / Package | Purpose |
|---|---|
| `packages/parser` | Ohm.js grammar definition (`grammar.ohm`) and AST generator |
| `packages/modules` | Module graph resolution and multi-file recipe composer |
| `packages/kitchen` | Compiler translating the AST into structured JSON, warnings, and schedules |
| `packages/format` | Canonical source code formatter for `.gram` files |
| `packages/analyzer` | Physical layer resolving mass normalization, unit conversion, and nutrition |
| `packages/renderer` | Display engine converting compiled JSON to HTML, Markdown, and Gantt charts |
| `packages/cli` | Command-line interface (`gram`) |
| `packages/i18n` | Localization layer for units, categories, and prompts |
| `packages/language-server` | LSP implementation for editor diagnostics and completions |
| `packages/vscode-extension` | Visual Studio Code extension built on the language server |
| `packages/docs` | Documentation website and browser playground (Astro + Starlight) |
| `conformance/` | Implementation-agnostic golden test suite for the compiler pipeline |
| `audit/` | Content and vocabulary auditor for embedded `.gram` snippets |

## Development workflow

### Rebuild before cross-package testing

In this monorepo, sibling packages are imported via `@gram-lang/*`, which resolves to their built `dist/` directories. If you modify a package (for example, `parser`), you must build the monorepo before testing dependent packages (such as `kitchen` or `analyzer`):

```bash
bun run build
```

### Grammar modifications

The grammar definition lives in `packages/parser/grammar.ohm`. Never edit the generated `packages/parser/src/grammar-content.ts` directly. A build script automatically inlines it during `bun run build`.

### Common commands

```bash
bun run build             # Build all packages in dependency order
bun test                  # Run unit tests across all packages
bun run lint              # Check code style with Biome
bun run lint:fix          # Auto-format and fix lint issues
bun run typecheck         # Verify TypeScript types across the monorepo
bun run conformance       # Run the golden-file pipeline tests
bun run change            # Create a changeset for published packages
```

## Submitting contributions

### Reporting issues

If you encounter a bug or unexpected behavior:
1. Check existing issues on [git.gram-lang.org](https://git.gram-lang.org/gram-lang/gram/issues).
2. Open a **Bug report** issue providing a minimal reproducible `.gram` snippet, the steps to reproduce, and the expected output.

### Syntax proposals (RFCs)

Gram is a language specification. Adding new syntax or altering keyword behavior affects the grammar, compiler, formatter, language server, and documentation.

Before submitting pull requests with syntax modifications:
1. Open an issue using the **Syntax proposal (RFC)** template.
2. Outline the motivation, real-world culinary use cases, proposed syntax examples, and compiler impact.
3. Wait for feedback and consensus before writing code.

### Changesets for package releases

If your pull request modifies the public API, behavior, or fixes a bug in a published package (any package under `packages/` except `docs`), include a changeset:

```bash
bun run change
```

Follow the prompt to select the affected packages, pick the bump type (`patch` or `minor`), and write a user-facing description in sentence case.

### Pull request checklist

Before submitting your pull request, verify:

1. **Formatting**: `bun run lint:fix`
2. **Type checking**: `bun run typecheck`
3. **Tests**: `bun test` passes (or `bun test --update-snapshots` if intentional)
4. **Conformance**: `bun run conformance` passes
5. **Changeset**: Included if modifying published packages

### Use of AI assistance

AI coding tools may be used to assist in writing code or documentation. Contributors submitting AI-assisted work are expected to review, understand, and verify their submissions locally to ensure they meet the project's quality, architecture, and testing standards.

## Code of conduct

Participation in the Gram project is governed by the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

## License

By contributing to Gram, you agree that your contributions will be licensed under the GPL-3.0 License.
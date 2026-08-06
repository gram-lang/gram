# Contributing to Gram

Thank you for your interest in contributing to Gram. Gram is an open-source markup language and toolset designed to treat recipes like code. Contributions of all kinds — bug reports, documentation fixes, syntax proposals, example `.gram` recipes, and code improvements — are welcome.

## Development Platforms

Primary development, issue tracking, and pull requests take place on the main Forgejo instance:

* **Primary Forge:** [git.gram-lang.org/gram-lang/gram](https://git.gram-lang.org/gram-lang/gram)
* **Mirrors:** [GitHub](https://github.com/gram-lang/gram) and [Codeberg](https://codeberg.org/gram-lang/gram)

Contributions and discussions are accepted on any of these platforms.

## Getting Started

Local development of the monorepo requires [Bun](https://bun.sh/).

### Prerequisites and Setup

1. Clone the repository and install dependencies:
   ```bash
   git clone https://git.gram-lang.org/gram-lang/gram.git
   cd gram
   bun install
   ```

2. Start the development server for the documentation website and playground:
   ```bash
   bun run dev
   ```

### Project Layout

The repository is structured as a monorepo under `packages/`:

| Package | Purpose |
|---|---|
| `parser` | Ohm.js grammar definition and AST generation |
| `kitchen` | Compiler translating the AST into structured JSON and warnings |
| `format` | Canonical source code formatter for `.gram` files |
| `analyzer` | Physical layer resolving mass normalization, unit conversion, and nutrition |
| `renderer` | Display engine converting compiled JSON to HTML, Markdown, or Gantt charts |
| `cli` | Command-line interface (`gram`) |
| `i18n` | Localization layer for units, categories, and prompts |
| `language-server` | LSP implementation for editor integration |
| `vscode-extension` | Visual Studio Code extension built on the language server |
| `docs` | Documentation website and web playground |

## Submitting Contributions

### Reporting Issues
If you encounter a bug or unexpected behavior, open an issue with a clear description, minimal steps or a `.gram` snippet to reproduce it, and the expected versus actual behavior.

### Syntax Proposals (RFCs)
Gram defines a language specification. Changes or additions to syntax have broad implications across the compiler and tooling. Before submitting code for syntax modifications, please open an issue or discussion tagged as an RFC to discuss the proposal and design goals.

### Code Guidelines & Quality Checks
Before submitting a pull request, ensure your changes adhere to project standards:

1. **Formatting & Linting**: Run `bun run lint:fix` to format code using Biome.
2. **Type Checking**: Run `bun run typecheck` across all packages.
3. **Tests**: Run unit tests with `bun test`. If updating syntax or AST output intentionally, update test snapshots where applicable (`bun test --update-snapshots`).
4. **Conformance**: Run `bun run conformance` to ensure compiler output remains consistent.
5. **Changesets**: If your change modifies public package APIs or behavior, create a changeset by running `bun run change`.

### Use of AI Assistance

AI tools may be used to assist in writing code or documentation. Contributors submitting AI-assisted work are expected to review, understand, and verify their submissions to ensure they meet the project's quality and architectural standards.

## License

By contributing to Gram, you agree that your contributions will be licensed under the GPL-3.0 License.
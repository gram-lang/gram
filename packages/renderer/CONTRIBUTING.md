# Contributing to the renderer

The renderer turns a compiled recipe into views. The engine computes, the views only show: a view reads what `prepareViews()` worked out (the schedule, the run sheet, the serving times) and never computes a schedule of its own.

## How it is laid out

- `src/prepare-views.ts`: the one entry point. It takes the recipe, the view settings and the serving context, and works out the costly parts once, only when a view reads them.
- `src/contract.ts`: what a view (`ViewDefinition`) and an inspector (`InspectorDefinition`) are, and the formats (`FORMATS`, with `FORMAT_DEFINITIONS` saying how a screen shows each one).
- `src/views/<id>/`: one folder per view (its id in kebab case: `runSheet` lives in `run-sheet/`), with its formats, its `view.ts`, its screen stylesheet `screen.css` and its print stylesheet `print.css`. `src/views/registry.ts` lists them in `views`.
- `src/inspectors/`: the looks at the pipeline (AST, JSON, JSON tree), listed in `inspectors`.
- `src/shared/`: what several views use (formatting of a step, nutrition, icons, the base print stylesheet, and on screen only the tokens, the frame and the floating tooltip).
- `src/settings.ts`: the descriptors of the view and recipe settings, the one source of truth every surface reads.

A view never imports another view. What two views share goes in `shared/`. `tests/views-imports.test.ts` checks it.

## Adding a view

1. Create `src/views/<id>/`. It imports only its own files, `shared/`, the contract, the settings, the types, `prepareViews` and the pipeline packages.
2. Write its `view.ts`, a `ViewDefinition`: its `formats` (only those it can really express, and always `html`: the editor's panel and the playground show a view in html; `gram export` writes `markdown`, `print` and `text`, and `gram print` needs `print`, so a view with `html` alone is on screen only), the settings it `honors`, what it `needs` from the input (`schedule`, `runSheet`, `serveTimes`), and `render()`. Return `null` when the recipe has nothing for it.
3. Write its `screen.css`, the stylesheet of its `html` format: every rule inside one `@scope (.gram-<folder>)`, and its html written in a root element of that class (`<section class="gram-run-sheet">`). It reuses no class of another view's stylesheet, only the tokens of `shared/tokens.css`. The build adds it to `gram.css` from the registry; `tests/views-styles.test.ts` checks the scope and the root.
4. Add it to `views` in `src/views/registry.ts`, and to `outputs` in `src/outputs.ts` (written out, not spread, so a bundler can drop the views a page does not use). Give it a name in every language, under `renderer.outputs` of `@gram-lang/i18n`: the surfaces list the outputs by that name.
5. Run `tests/views-contract.test.ts`. It renders the view in each format for every fixture, checks the escaping, and checks that the view reacts to each setting it honors and to no other. If it honors a setting none of the fixtures shows, extend a fixture.
6. If the view brings a new setting: add its descriptor to `VIEW_SETTINGS` in `src/settings.ts`, a probe to `PROBES` in the contract test, a `gram.*` key in the VS Code extension's `package.json` (the parity test fails until it exists), and the docs in English and French.
7. If the view brings a new format: add it to `Format` and `FORMATS`, describe it in `FORMAT_DEFINITIONS` (`page`, `code` with its highlighting language, or `none`; the build fails until you do), and name it under `renderer.formats` of `@gram-lang/i18n` in every language. The playground and the editor read how to show it from there.
8. Document the view in English and French (what it shows, its formats, the settings it follows), and add a changeset: a new view is a new feature of every surface.

Nothing else should need an edit, not even a test of a surface: the surfaces list their outputs from the registry, so a new view appears in the CLI, VS Code and the playground. Removing a view is the reverse.

Every surface lists its outputs from the registry: the language server and the VS Code extension, the playground (as tabs, with the formats of each view), and the CLI (`--view` of `gram export` and `gram print`, each `--format` checked against the view's `formats`). The terminal views of `gram view` and `gram cook` are not renderer strings and stay apart.

## Checks

```bash
bun run --cwd packages/renderer build
bun run --cwd packages/renderer test
```

The print styles live in real stylesheets (`src/shared/print.css`, then each view's `print.css`), bundled as text: edit those, not the `.ts` wrappers.

The screen styles are each view's `screen.css`, after the shared `src/shared/tokens.css`, `base.css` and `tooltip.css`. The build (`scripts/build-css.mjs`) joins them in the registry's order into `dist/gram.css`, the file the package ships as `@gram-lang/renderer/gram.css` and the VS Code extension copies: never edit the generated file. They stay out of the JavaScript bundle, since every surface loads them as a file. `.gram-preview` is the class a surface puts around a view, any view: it carries the type, never the style of a view.

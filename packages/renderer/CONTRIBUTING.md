# Contributing to the renderer

The renderer turns a compiled recipe into views. The engine computes, the views only show: a view reads what `prepareViews()` worked out (the schedule, the work plan, the serving times) and never computes a schedule of its own.

## How it is laid out

- `src/prepare-views.ts`: the one entry point. It takes the recipe, the view settings and the serving context, and works out the costly parts once, only when a view reads them.
- `src/contract.ts`: what a view (`ViewDefinition`) and an inspector (`InspectorDefinition`) are.
- `src/views/<id>/`: one folder per view, with its formats and its `view.ts`. `src/views/registry.ts` lists them in `views`.
- `src/inspectors/`: the looks at the pipeline (AST, JSON, JSON tree), listed in `inspectors`.
- `src/shared/`: what several views use (formatting of a step, nutrition, icons, the base print stylesheet).
- `src/settings.ts`: the descriptors of the view and recipe settings, the one source of truth every surface reads.

A view never imports another view. What two views share goes in `shared/`. `tests/views-imports.test.ts` checks it.

## Adding a view

1. Create `src/views/<id>/`. It imports only its own files, `shared/`, the contract, the settings, the types, `prepareViews` and the pipeline packages.
2. Write its `view.ts`, a `ViewDefinition`: its `formats` (only those it can really express), the settings it `honors`, what it `needs` from the input (`schedule`, `runSheet`, `serveTimes`), and `render()`. Return `null` when the recipe has nothing for it.
3. Add it to `views` in `src/views/registry.ts`, and to `outputs` in `src/outputs.ts` (written out, not spread, so a bundler can drop the views a page does not use). Give it a name in every language, under `renderer.outputs` of `@gram-lang/i18n`: the surfaces list the outputs by that name.
4. Run `tests/views-contract.test.ts`. It renders the view in each format for every fixture, checks the escaping, and checks that the view reacts to each setting it honors and to no other. If it honors a setting none of the fixtures shows, extend a fixture.
5. If the view brings a new setting: add its descriptor to `VIEW_SETTINGS` in `src/settings.ts`, a probe to `PROBES` in the contract test, a `gram.*` key in the VS Code extension's `package.json` (the parity test fails until it exists), and the docs in English and French.

Nothing else should need an edit: the surfaces list their outputs from the registry, so a new view appears in the CLI, VS Code and the playground. Removing a view is the reverse.

The surfaces are moving onto the registry. The language server, the VS Code extension and the playground already list their outputs from it; until the CLI does too, a new view still has to be added by hand to its commands.

## Checks

```bash
bun run --cwd packages/renderer build
bun run --cwd packages/renderer test
```

The print styles live in real stylesheets (`src/shared/print.css`, then each view's `print.css`), bundled as text: edit those, not the `.ts` wrappers.

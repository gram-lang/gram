# @gram-lang/docs

The Gram documentation site and browser playground: [gram-lang.org](https://gram-lang.org). Built with [Astro](https://astro.build) + [Starlight](https://starlight.astro.build), with a Vue-based playground island.

## Structure

```text
src/
├── components/       # Astro components (homepage, header/footer, Starlight overrides)
│   └── playground/    # Vue playground: editor, output panes, options
├── content/
│   ├── docs/           # Starlight docs collection (EN at docs/docs/**, FR at docs/fr/docs/**)
│   └── blog/            # Blog posts (en/, fr/)
├── data/              # Structured content: homepage copy, blog topics, API reference data
├── layouts/           # Layout.astro — shared shell for non-Starlight pages (home, blog, playground)
├── lib/               # Shared utilities (head scripts, FR/EN post resolution)
├── pages/             # Astro routes; fr/ mirrors the English tree
└── styles/            # global.css, passed to Starlight via customCss
```

Routing: Starlight docs live under `/docs/**` and `/fr/docs/**` (not at the root) purely via content-collection file layout, so they don't collide with the Astro-native homepage at `/`.

## Commands

Run from this directory, or via `turbo`/`bun run --filter=@gram-lang/docs <script>` from the repo root:

| Command          | Action                                                    |
| :--------------- | :--------------------------------------------------------- |
| `bun dev`        | Start the dev server at `localhost:4321`                    |
| `bun run build`  | Build the static site to `./dist/`, then check bundle size |
| `bun run preview`| Preview the production build locally                       |
| `bun run typecheck` | Run `astro check`                                        |

No environment variables are required — the site builds fully statically, with no runtime secrets.

## Notes

- `astro`/`@astrojs/starlight`/`@astrojs/vue`/`@astrojs/mdx`/`@astrojs/markdown-remark` are pinned to the current stable range in `package.json`; keep them on `^7.1.x`/Starlight `^0.41.x` or later — `astro@7.0.2`'s dev server is broken in this hoisted Bun monorepo (fixed in `7.1.5`).
- `scripts/check-bundle-size.mjs` enforces a size budget on the playground's JS chunk (CodeMirror 6 + Shiki, self-hosted); raise the budget deliberately in that file if a change legitimately grows it.
- `scripts/generate-llms-full.ts` regenerates `public/llms-full.txt`/`llms.txt` as a `prebuild` step.

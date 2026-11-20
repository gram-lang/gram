# @gram-lang/format

## 1.5.0

### Minor Changes

- a17ebc8: **Language Server, VS Code & Format**: Editors and the formatter now support sums of quantities (`@flour{1 cup + 1 tbsp}`):
  - Quick fixes convert adjacent quantities into a sum (`{1 cup 5 tbsp}` → `{1 cup + 5 tbsp}`), apply suggested percentage resolutions (`{100 g + 10%}` → `{110 g}`), and clarify `oz` after a volume as `fl oz`.
  - Hover previews show the combined total (`= 17 tbsp`) or distinct unit kinds, along with estimated weight from the ingredient database.
  - Unit completion works inside each term of a sum once its number is typed (`{1 cup + 2`).
  - `gram format` spaces `+` and `-` in ingredient sums (leaving ranges, timers, and temperatures untouched) and trims trailing zeros across quantities (`{1.50 kg}` → `{1.5 kg}`, `~{1.50 h}` → `~{1.5 h}`), reporting operator spacing fixes in `quantityOperatorSpacing`.
- e0f8fbf: **Parser & Kitchen**: Decimal numbers can now be written with a comma as well as a point (`{1,5 kg}` and `{1.5 kg}`):
  - Supported in all braced numbers (ingredients, ranges, relative quantities, cookware, temperatures, timers, and section anchors) and displayed in the reader's locale.
  - Commas followed by exactly three digits (`{1,000 g}`) are still read as decimals (`1 g`), with a new `AMBIGUOUS_NUMBER` warning in case a thousand was intended (while `{1.000 kg}` remains `1 kg` without warning).
  - `gram format` trims trailing zeros after a comma (`{1,50}` → `{1,5}`) while keeping `{1,000}` as written.
- f91ec4e: **Parser & Kitchen**: Steps can now mark inline target states with an optional glued verification note (`Whisk until ={ribbon stage}(the batter falls back in a continuous ribbon).`):
  - Only the state sits inside `={…}`, with an optional single-line note attached to `}`; unclosed or empty `={` raises a syntax error, and braceless `@ingredient` names end before a target state (`@salt until ={taste}`).
  - Compiled steps emit a `checkpoint` token (`state`, plus optional `note`) without affecting scaling, scheduling, or the shopping list.
  - Rendered across HTML, Markdown, plain text, and print views; `gram cook` shows checkpoints below each step and reminds you when a step timer rings.
  - `gram diff` tracks added, removed, and changed target states, `gram import` preserves them from sources, and editors highlight them.

## 1.4.2

### Patch Changes

- 268c8ea: **Format**: Fixed a temperature written with a space and trailing zeros, such as `^{160.0 °C}`, that took two runs of the formatter to become `^{160°C}`: it is now fixed in one.

## 1.4.1

No changes in this release.

## 1.4.0

No changes in this release.

## 1.3.0

No changes in this release.

## 1.2.1

## 1.2.0

## 1.1.0

## 1.0.1

## 1.0.0

### Major Changes

- Gram v1.0.0 Official Launch! 🎉

  This milestone release marks the official 1.0.0 launch of Gram:

  - **Brand-New Website & Documentation**: Rebuilt using Astro and Starlight with refined guides and an integrated blog.
  - **Refreshed Visual Identity**: Brand-new logo.
  - **Infrastructure & Stability**: Monorepo stability, test coverage, and migration to self-hosted Forgejo (`git.gram-lang.org`) mirrored to GitHub and Codeberg.

## 1.0.0-beta.5

### Minor Changes

- cf39429: Introduce `@gram-lang/format`, a standalone canonical code formatting engine for `.gram` files with 13 deterministic rules, used by the CLI and Language Server.
- 99aa179: Fixed two bugs in the recipe formatter:

  - A `#cookware` reference at the very start of a line (e.g. `#pan(20cm)`) was incorrectly treated as a malformed section header and got a space inserted after the `#`, turning it into plain text and silently breaking the recipe.
  - Blank-line spacing before a `## Section` header was being promoted to two blank lines instead of Gram's actual convention of exactly one blank line between every step and/or section. The formatter now consistently enforces a single blank line everywhere, including before section headers. As a result, the `sectionSpacing` counter (previously reported alongside `consecutiveBlankLines`) has been removed — this kind of spacing fix is now reported as part of `consecutiveBlankLines`.

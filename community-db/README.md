# Community Ingredient Databases

A place for community-contributed starter `ingredients.yaml` files — organized by language and/or cuisine — that Gram users can pull into their own project database with `gram db merge`.

## Why this exists, and why it's opt-in

Gram deliberately doesn't ship or integrate a built-in nutrition/density database (no CIQUAL, no USDA, no OpenFoodFacts). Density and nutrition are product-specific, not universal — see [Data Philosophy](https://gram-lang.org/docs/explanation/philosophy#data-philosophy-why-no-external-nutrition-database) for the full reasoning.

Files in this directory are the opt-in middle ground: a starting point you can review and merge into your own database, never something Gram reaches for automatically. **They are not verified against any official reference and may not match your specific products.** Always review what `gram db merge` proposes before accepting it — see [Sharing and Merging Databases](https://gram-lang.org/docs/how-to/manage-database#sharing-and-merging-databases) for the full workflow.

There are no files here yet — this directory ships with just this README so early adopters can contribute a first batch via pull request rather than inheriting unreviewed values from the maintainer.

## Using a community database

Grab the file you want from this repository, then merge it into your local `ingredients.yaml`:

```bash
gram db merge path/to/downloaded-file.yaml
```

`gram db merge` matches entries by key, name, and aliases; unions tags/aliases; and only asks you to resolve genuine conflicts, defaulting to keep your own local data (see `--prefer local|remote`).

## Contributing a database file

1. Name your file `<language>-<theme>.yaml` (e.g. `fr-classic.yaml`, `en-baking.yaml`), using a [BCP 47](https://en.wikipedia.org/wiki/IETF_language_tag) primary language subtag.
2. Follow the ingredient schema documented at `packages/analyzer/tests/fixtures/ingredients.yaml`.
3. Validate before opening a pull request:
   ```bash
   gram db validate --db community-db/<your-file>.yaml --strict
   ```
4. In your pull request description, note what you based your values on — even informally ("measured with a kitchen scale," "average of a few brands I checked") — so reviewers and future users know how much to trust each entry.

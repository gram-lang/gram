#!/usr/bin/env node
// Guards against silent bundle bloat regressions.
// The playground (parser+kitchen+analyzer+renderer+CodeMirror+Shiki) is only
// loaded on /play and /fr/play via client:only="vue", so unlike docs-legacy's
// VitePress SPA there is no shared "app entry" chunk to budget — Astro already
// isolates each page's JS.
//
// The editor (CodeMirror 6) and its Shiki syntax highlighting are fully
// self-hosted and bundled into this chunk — unlike the Monaco-based version
// this replaced, which streamed Monaco's editor core from a third-party CDN
// at runtime and so never counted toward this budget at all. ~712KB raw here
// (~220KB gzipped) is the full, honest cost users pay, same-origin, with no
// external CDN round-trip. Shiki's oniguruma WASM regex engine is a separate
// lazy-loaded chunk (not counted here) — it's fetched once and doesn't grow
// with this component's own code.
//
// The budget counts the playground chunk alone, so it moves when code changes
// chunk, not only when it grows. It was 800 KB while a 338 KB module shared
// with the (lazy) Gantt chart sat in a chunk of its own; once the playground
// stopped loading the Gantt chart, that module was folded back in. The total
// shipped (this chunk plus that one) went from 849 KB to 847 KB when the work
// plan replaced the Gantt chart: the budget follows the move, not a growth.
//
// It went from 900 KB to 930 KB in 1.4.0, a growth this time: the playground
// lists its outputs from the renderer's registry (886 KB to 920 KB), and a
// view's render() carries every format it has, so the bundler keeps them all.
// They are all offered: HTML, Markdown and Text in the output pane, print
// behind the Print button.
//
// It went from 930 KB to 1000 KB, still in 1.4.0: the recipe view gained its
// text format (927.6 KB against the 930 KB budget before the words of the other
// formats moved into the dictionaries). The playground is a showcase, and the
// budget is an alarm against a bundle that balloons, not a target to squeeze.
// It went from 1000 KB to 1040 KB in 1.5.0: sums of quantities
// (`{1 cup + 1 tbsp}`) brought their grammar (999.2 KB), then the compiler's
// reading of them, their warnings and their messages (1005.5 KB), with the
// shopping list, the analyzer, the display and the editor tooling still to come.
// It went from 1040 KB to 1060 KB, still in 1.5.0: the playground shows its
// ingredient database in an `ingredients.yaml` tab (1038.8 KB to 1042.6 KB:
// the tab, its notice in both languages, the warnings that lead to it). The
// YAML text itself loads in a chunk of its own when the tab opens, and its
// data is parsed at build time, so no YAML parser ships.
// It went from 1060 KB to 1065 KB in 1.6.0: the compiler's writing hints
// (`&flour` on a raw ingredient, Cooklang's `%` separator, a temperature in
// cookware braces) brought their checks and messages (1059.1 KB to 1060.6 KB).

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ASSETS_DIR = join(import.meta.dirname, "..", "dist", "_astro");

const BUDGETS_KB = {
	"playground chunk (client:only, but should not balloon)": {
		pattern: /^GramPlayground\..*\.js$/,
		maxKb: 1065,
	},
};

const files = readdirSync(ASSETS_DIR);

let failed = false;
for (const [label, { pattern, maxKb }] of Object.entries(BUDGETS_KB)) {
	const match = files.find((f) => pattern.test(f));
	if (!match) {
		console.error(
			`✗ No file matched for "${label}" (pattern ${pattern}) — build output may have changed shape, so this budget can no longer be enforced.`,
		);
		failed = true;
		continue;
	}
	const sizeKb = statSync(join(ASSETS_DIR, match)).size / 1024;
	const status = sizeKb <= maxKb ? "✓" : "✗";
	console.log(`${status} ${label}: ${sizeKb.toFixed(1)} KB (budget: ${maxKb} KB)`);
	if (sizeKb > maxKb) failed = true;
}

if (failed) {
	console.error(
		"\nBundle size budget exceeded. If this growth is expected, raise the budget in scripts/check-bundle-size.mjs deliberately.",
	);
	process.exit(1);
}

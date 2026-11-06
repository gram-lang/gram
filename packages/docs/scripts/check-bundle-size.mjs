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

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ASSETS_DIR = join(import.meta.dirname, "..", "dist", "_astro");

const BUDGETS_KB = {
	"playground chunk (client:only, but should not balloon)": {
		pattern: /^GramPlayground\..*\.js$/,
		maxKb: 930,
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

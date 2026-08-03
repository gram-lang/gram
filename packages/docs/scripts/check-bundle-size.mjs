#!/usr/bin/env node
// Guards against silent bundle bloat regressions.
// The playground (parser+kitchen+analyzer+renderer+Monaco glue) is only loaded
// on /play and /fr/play via client:only="vue", so unlike docs-legacy's VitePress
// SPA there is no shared "app entry" chunk to budget — Astro already isolates
// each page's JS. Monaco's own editor core is streamed from a CDN by
// @guolao/vue-monaco-editor (not bundled here), so this budget only covers our
// own code + Shiki + the Vue wrapper.

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ASSETS_DIR = join(import.meta.dirname, "..", "dist", "_astro");

const BUDGETS_KB = {
	"playground chunk (client:only, but should not balloon)": {
		pattern: /^GramPlayground\..*\.js$/,
		maxKb: 500,
	},
};

const files = readdirSync(ASSETS_DIR);

let failed = false;
for (const [label, { pattern, maxKb }] of Object.entries(BUDGETS_KB)) {
	const match = files.find((f) => pattern.test(f));
	if (!match) {
		console.warn(
			`⚠ No file matched for "${label}" (pattern ${pattern}) — skipping, build output may have changed shape.`,
		);
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

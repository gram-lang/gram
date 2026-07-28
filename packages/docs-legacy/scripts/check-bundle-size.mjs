#!/usr/bin/env node
// Guards against silent bundle bloat regressions (audit Chantier 1/4).
// The playground (parser+kitchen+analyzer+renderer+Monaco) is lazy-loaded via
// defineAsyncComponent, so it must never leak into the app-wide entry chunk.

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ASSETS_DIR = join(import.meta.dirname, '..', 'src', '.vitepress', 'dist', 'assets');

const BUDGETS_KB = {
  'app entry chunk (loaded on every page)': { pattern: /^app\..*\.js$/, maxKb: 150 },
  'playground chunk (lazy-loaded, but should not balloon)': { pattern: /^chunks\/GramPlayground\..*\.js$/, maxKb: 400 },
};

function collectFiles(dir, prefix = '') {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...collectFiles(join(dir, entry.name), rel));
    else files.push(rel);
  }
  return files;
}

let failed = false;
const files = collectFiles(ASSETS_DIR);

for (const [label, { pattern, maxKb }] of Object.entries(BUDGETS_KB)) {
  const match = files.find(f => pattern.test(f));
  if (!match) {
    console.warn(`⚠ No file matched for "${label}" (pattern ${pattern}) — skipping, build output may have changed shape.`);
    continue;
  }
  const sizeKb = statSync(join(ASSETS_DIR, match)).size / 1024;
  const status = sizeKb <= maxKb ? '✓' : '✗';
  console.log(`${status} ${label}: ${sizeKb.toFixed(1)} KB (budget: ${maxKb} KB)`);
  if (sizeKb > maxKb) failed = true;
}

if (failed) {
  console.error('\nBundle size budget exceeded. If this growth is expected, raise the budget in scripts/check-bundle-size.mjs deliberately.');
  process.exit(1);
}

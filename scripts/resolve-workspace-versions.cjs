// Rewrites `workspace:*` / `workspace:^` / `workspace:~` dependency ranges to
// the real pinned version of the referenced package, in place, on disk.
//
// @changesets/cli always shells out to the plain `npm` binary to publish
// (see getPublishTool in @changesets/cli) — it never resolves the bun/pnpm
// workspace protocol itself. Left untouched, `workspace:*` ends up published
// verbatim into the npm manifest, which breaks installation for consumers.
// Run this once, right before `npx changeset publish`, against the CI clone
// only — it never gets committed.
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageDirs = fs
  .readdirSync(path.join(root, "packages"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(root, "packages", entry.name));

const manifestPaths = packageDirs
  .map((dir) => path.join(dir, "package.json"))
  .filter((p) => fs.existsSync(p));

const versionsByName = new Map();
for (const manifestPath of manifestPaths) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  versionsByName.set(manifest.name, manifest.version);
}

const depFields = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

for (const manifestPath of manifestPaths) {
  const raw = fs.readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(raw);
  let changed = false;

  for (const field of depFields) {
    const deps = manifest[field];
    if (!deps) continue;
    for (const [depName, range] of Object.entries(deps)) {
      if (typeof range !== "string" || !range.startsWith("workspace:")) continue;
      const version = versionsByName.get(depName);
      if (!version) {
        throw new Error(
          `${manifestPath}: cannot resolve "${depName}: ${range}" — no local package named "${depName}"`,
        );
      }
      const protocol = range.slice("workspace:".length);
      const resolved = protocol === "*" || protocol === "" ? version : `${protocol}${version}`;
      deps[depName] = resolved;
      changed = true;
      console.log(`${manifest.name}: ${depName} ${range} -> ${resolved}`);
    }
  }

  if (changed) {
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

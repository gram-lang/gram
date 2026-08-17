import { readFile } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import type { ModuleHost } from "@gram-lang/modules";

// Matches `@/rest.gram` (bare root, alias = "") and `@alias/rest.gram` — the
// two `@`-prefixed forms `@gram-lang/modules`' own `validateSpecifier`
// accepts (module-imports RFC §B.1). Anything after the slash, including
// more slashes, is the path under that base.
const AT_SPECIFIER_RE = /^@([^/]*)\/(.+)$/;

function confine(
	resolved: string,
	projectRoot: string,
	specifier: string,
): string {
	const rel = relative(projectRoot, resolved);
	if (rel === "") return resolved;
	if (rel.startsWith("..") || isAbsolute(rel)) {
		throw new Error(
			`"${specifier}" resolves outside the project root (${projectRoot}).`,
		);
	}
	return resolved;
}

/**
 * The CLI's `ModuleHost` implementation (module-imports RFC §B.2): resolves
 * `@use "./x.gram"` specifiers against the importing file's own directory,
 * confined to `projectRoot` (`resolveDbPath`, `core/db.ts:12`, is the
 * existing precedent for resolving something project-relative). `resolve`
 * stays pure path arithmetic — no filesystem access, only `path` — so a
 * confinement violation throws synchronously and `loadModuleGraph` turns it
 * into a `MODULE_SPECIFIER_INVALID` diagnostic rather than a crash.
 *
 * `paths` is the project's `.gram/config.yaml` `paths:` map (alias name →
 * directory, relative to `projectRoot`) — `@use "@bases/pate.gram"` with
 * `paths: { bases: "./shared/bases" }` resolves to
 * `<projectRoot>/shared/bases/pate.gram`. The bare `@/...` form (no alias
 * name) always means `projectRoot` itself and needs no entry in `paths`.
 */
export function createCliModuleHost(
	projectRoot: string,
	paths?: Record<string, string>,
): ModuleHost {
	return {
		resolve(specifier: string, fromUri: string): string {
			const atMatch = AT_SPECIFIER_RE.exec(specifier);
			if (atMatch) {
				const [, alias, rest] = atMatch;
				if (alias === "") {
					return confine(resolve(projectRoot, rest!), projectRoot, specifier);
				}
				const aliasDir = paths?.[alias!];
				if (aliasDir === undefined) {
					throw new Error(
						`"@${alias}/" is not declared. Add it to "paths:" in .gram/config.yaml (e.g. paths: { ${alias}: ./some/dir }).`,
					);
				}
				return confine(
					resolve(projectRoot, aliasDir, rest!),
					projectRoot,
					specifier,
				);
			}
			const resolved = resolve(dirname(fromUri), specifier);
			return confine(resolved, projectRoot, specifier);
		},
		read(uri: string): Promise<string> {
			return readFile(uri, "utf-8");
		},
	};
}

import { readFile } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import type { ModuleHost } from "@gram-lang/modules";

/**
 * The CLI's `ModuleHost` implementation (module-imports RFC §B.2): resolves
 * `@use "./x.gram"` specifiers against the importing file's own directory,
 * confined to `projectRoot` (`resolveDbPath`, `core/db.ts:12`, is the
 * existing precedent for resolving something project-relative). `resolve`
 * stays pure path arithmetic — no filesystem access, only `path` — so a
 * confinement violation throws synchronously and `loadModuleGraph` turns it
 * into a `MODULE_SPECIFIER_INVALID` diagnostic rather than a crash.
 */
export function createCliModuleHost(projectRoot: string): ModuleHost {
	return {
		resolve(specifier: string, fromUri: string): string {
			const resolved = resolve(dirname(fromUri), specifier);
			const rel = relative(projectRoot, resolved);
			if (rel === "") return resolved;
			if (rel.startsWith("..") || isAbsolute(rel)) {
				throw new Error(
					`"${specifier}" resolves outside the project root (${projectRoot}).`,
				);
			}
			return resolved;
		},
		read(uri: string): Promise<string> {
			return readFile(uri, "utf-8");
		},
	};
}

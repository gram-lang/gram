import type { ModuleHost } from "./host";

// Matches `@/rest.gram` (bare root) — the one `@`-prefixed form this host
// understands. `@alias/rest.gram` (a `paths:` alias) has no equivalent here:
// the in-memory VFS has no config surface to declare aliases against, so it
// resolves like any other unrecognized specifier and `loadModuleGraph`
// reports it as `MODULE_SPECIFIER_INVALID`, same failure shape a caller
// already sees from the CLI host for an *undeclared* alias.
const ROOT_SPECIFIER_RE = /^@\/(.+)$/;

/**
 * An in-memory `ModuleHost`: a flat map of `uri` → source, POSIX-style
 * relative path resolution, no real filesystem. `uri`s are plain strings
 * like `"/recipe.gram"` or `"/bases/pate.gram"` — always absolute-looking so
 * `resolve` has an unambiguous "directory of the importer" to resolve
 * against, without needing an actual project root. `"@/..."` resolves
 * against this VFS's own root (`"/"`).
 *
 * Used by the unit tests in `tests/fake-host.ts` (re-exported from there
 * under its original name) and by the docs playground's multi-file editor,
 * which has no filesystem and no project-root concept at all.
 */
export function createMemoryHost(
	files: Map<string, string> | Record<string, string>,
): ModuleHost {
	const get =
		files instanceof Map
			? (uri: string) => files.get(uri)
			: (uri: string) => files[uri];

	return {
		resolve(specifier: string, fromUri: string): string {
			const rootMatch = ROOT_SPECIFIER_RE.exec(specifier);
			const relativeTo = rootMatch ? "/" : fromUri;
			const rest = rootMatch ? rootMatch[1]! : specifier;
			const fromDir = relativeTo.slice(0, relativeTo.lastIndexOf("/")) || "/";
			const parts = `${fromDir}/${rest}`.split("/");
			const stack: string[] = [];
			for (const part of parts) {
				if (part === "" || part === ".") continue;
				if (part === "..") stack.pop();
				else stack.push(part);
			}
			return `/${stack.join("/")}`;
		},
		read(uri: string): string {
			const source = get(uri);
			if (source === undefined) throw new Error(`ENOENT: ${uri}`);
			return source;
		},
	};
}

/**
 * A reverse-dependency index: dep uri -> the set of uris that directly
 * `@use` it. Built from a flat edge list (importer -> dep) rather than from
 * a single `ModuleGraph`, since both consumers need edges collected across
 * *many* entry points, not one entry's transitive closure:
 *
 * - `gram watch` (module-imports RFC §F.0.3) needs to know, for every
 *   `.gram` file under the watched directory, who (transitively) imports it
 *   — not just what the changed file itself imports — so editing a base
 *   recipe re-checks every recipe that uses it, not only the file that
 *   changed on disk.
 * - The language server (RFC §G) needs the same thing to invalidate an open
 *   importer's diagnostics when an unsaved dependency changes.
 *
 * Kept host-agnostic here (no filesystem, no parsing) so it's written once
 * instead of twice — each caller collects its own edges (the CLI walks the
 * watched directory and parses every file's own `@use` lines; the language
 * server walks its open-document set) and hands them to
 * `buildReverseDependencyIndex`.
 */
export type ReverseDependencyIndex = Map<string, Set<string>>;

export interface DependencyEdge {
	/** The uri that declares the `@use`. */
	from: string;
	/** The uri it imports. */
	to: string;
}

export function buildReverseDependencyIndex(
	edges: Iterable<DependencyEdge>,
): ReverseDependencyIndex {
	const index: ReverseDependencyIndex = new Map();
	for (const { from, to } of edges) {
		let importers = index.get(to);
		if (!importers) {
			importers = new Set();
			index.set(to, importers);
		}
		importers.add(from);
	}
	return index;
}

/**
 * Every uri that transitively depends on `uri` — directly or through a
 * chain of imports — per `index`. Does not include `uri` itself. This is
 * the set that needs re-checking (or, for the language server, re-linting)
 * when `uri` changes.
 */
export function transitiveDependents(
	index: ReverseDependencyIndex,
	uri: string,
): Set<string> {
	const result = new Set<string>();
	// Seeded with `uri` itself so an import cycle (A -> B -> A) can't loop
	// back around and report `uri` as its own dependent.
	const visited = new Set<string>([uri]);
	const stack = [uri];
	while (stack.length > 0) {
		const current = stack.pop()!;
		const importers = index.get(current);
		if (!importers) continue;
		for (const importer of importers) {
			if (!visited.has(importer)) {
				visited.add(importer);
				result.add(importer);
				stack.push(importer);
			}
		}
	}
	return result;
}

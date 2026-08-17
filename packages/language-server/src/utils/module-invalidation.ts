import {
	buildReverseDependencyIndex,
	transitiveDependents,
	type ModuleGraph,
	type ReverseDependencyIndex,
} from "@gram-lang/modules";

/**
 * Builds the reverse-dependency index purely from the graphs of currently
 * open documents (module-imports RFC §F.1) — simpler than `gram watch`'s
 * own version (`packages/cli/src/core/watch-graph.ts`), which has to scan a
 * whole directory of files since it has no "already open" set to lean on.
 * Here, every edge that could possibly matter is already sitting in some
 * open document's own graph: an open document's `ModuleGraph` carries a
 * full `ModuleRecord` (including *its* own `imports`) for every file in its
 * transitive closure, open or not.
 */
export function buildOpenReverseIndex(
	graphs: ReadonlyMap<string, ModuleGraph>,
): ReverseDependencyIndex {
	const edges: { from: string; to: string }[] = [];
	for (const graph of graphs.values()) {
		for (const [uri, record] of graph.modules) {
			for (const imp of record.imports) {
				edges.push({ from: uri, to: imp.uri });
			}
		}
	}
	return buildReverseDependencyIndex(edges);
}

/**
 * Every currently *open* document that transitively depends on `changedUri`
 * — the set that needs a fresh `refresh()` when `changedUri`'s content
 * changes. This is the invalidation the RFC's own example calls for: with
 * `A -> B -> C`, editing `C` (even unsaved) must refresh `A`'s diagnostics
 * through `B`, not just `B`'s own. A dependency that shows up in the
 * reverse index but isn't itself an open document (e.g. a leaf base nobody
 * has opened as its own tab) is filtered out — there's no live editor state
 * to refresh for it.
 */
export function affectedOpenImporters(
	graphs: ReadonlyMap<string, ModuleGraph>,
	openUris: Iterable<string>,
	changedUri: string,
): string[] {
	const index = buildOpenReverseIndex(graphs);
	const open = new Set(openUris);
	return [...transitiveDependents(index, changedUri)].filter((uri) =>
		open.has(uri),
	);
}

import { resolve as resolvePath } from "node:path";
import { loadModuleGraph } from "@gram-lang/modules";
import { createCliModuleHost } from "./module-host";
import { findProjectRoot } from "./workspace";

/**
 * Excludes files imported (directly or transitively) by another file in the
 * same batch (module-imports RFC §F.0, edge case #21): a base recipe matched
 * by the same glob as its importer would otherwise be counted twice — once
 * on its own, once again composed into the importer. Only `gram shop`/
 * `gram build` call this: every other glob consumer (`check`, `format`,
 * `suggest`, `db sync`) has no aggregation step, so it still wants every
 * matched file processed on its own.
 */
export async function filterModuleRoots(
	files: string[],
	projectRoot?: string,
): Promise<string[]> {
	if (files.length <= 1) return files;

	const root = projectRoot ?? (await findProjectRoot());
	const host = createCliModuleHost(root);
	const dependencyUris = new Set<string>();

	await Promise.all(
		files.map(async (file) => {
			const entryUri = resolvePath(file);
			const graph = await loadModuleGraph(entryUri, host);
			for (const uri of graph.modules.keys()) {
				if (uri !== entryUri) dependencyUris.add(uri);
			}
		}),
	);

	const roots = files.filter((f) => !dependencyUris.has(resolvePath(f)));
	// A cycle or an unusual graph could in principle exclude everything --
	// fall back to the unfiltered batch rather than silently emptying it.
	return roots.length > 0 ? roots : files;
}

import { readFile } from "node:fs/promises";
import { globSync } from "tinyglobby";
import { getAST, GramParseError } from "@gram-lang/parser";
import {
	buildReverseDependencyIndex,
	type ReverseDependencyIndex,
	type DependencyEdge,
} from "@gram-lang/modules";
import { createCliModuleHost } from "./module-host";

/**
 * The reverse-dependency index `gram watch` needs (module-imports RFC
 * §F.0.3): editing a base recipe should re-check every recipe that
 * `@use`s it, not just the file that changed on disk. Rebuilt on every
 * change batch rather than maintained incrementally — a directory of
 * recipes is small enough that a full re-scan is cheap next to the
 * check/build work watch already does per file, and it stays correct even
 * when the change itself added or removed an `@use` line.
 *
 * Reads and parses every `.gram` file under `watchDir` at depth one only
 * (each file's own direct `ast.imports`, not `loadModuleGraph`'s full
 * transitive closure) — cheaper than resolving every file's whole subgraph,
 * and sufficient because `transitiveDependents` already walks the reverse
 * edges to the same effect. A file that fails to parse, or whose specifier
 * fails to resolve (e.g. escapes the project root), simply contributes no
 * edge — watch has no diagnostic surface for "the index is stale", so it
 * degrades to "that one file's dependents aren't tracked" rather than
 * crashing.
 */
export async function buildWatchReverseIndex(
	watchDir: string,
	projectRoot: string,
	paths?: Record<string, string>,
): Promise<ReverseDependencyIndex> {
	const files = globSync("**/*.gram", {
		cwd: watchDir,
		absolute: true,
	});
	const host = createCliModuleHost(projectRoot, paths);
	const edges: DependencyEdge[] = [];

	await Promise.all(
		files.map(async (file) => {
			let source: string;
			try {
				source = await readFile(file, "utf-8");
			} catch {
				return;
			}
			let imports: ReturnType<typeof getAST>["imports"];
			try {
				imports = getAST(source).imports;
			} catch (err) {
				if (err instanceof GramParseError) return;
				throw err;
			}
			for (const decl of imports) {
				try {
					edges.push({ from: file, to: host.resolve(decl.specifier, file) });
				} catch {
					// Unresolvable specifier — no edge, see module docstring above.
				}
			}
		}),
	);

	return buildReverseDependencyIndex(edges);
}

import type { RecipeAST } from "@gram-lang/parser";
import type { Warning } from "@gram-lang/kitchen";
import type { ImportDecl } from "@gram-lang/parser";

/**
 * The one seam between this package and the outside world. This package
 * *defines* the interface but never implements it — resolving a specifier
 * to a URI and reading a URI's contents are both host-specific (the CLI
 * uses `node:path`/`node:fs`, the language server layers unsaved-editor
 * state over the filesystem, the playground has no filesystem at all, the
 * conformance runner resolves relative to a fixture directory) — see
 * `.notes/plan-ajout-imports-recettes.md` §B.2.
 */
export interface ModuleHost {
	/** Resolves `specifier` against the URI of the importing document. Pure path arithmetic — must not touch the filesystem. */
	resolve(specifier: string, fromUri: string): string;
	/** Reads the source at `uri`. Throws (or rejects) when it can't — `loadModuleGraph` turns that into a `MODULE_NOT_FOUND` diagnostic, never a crash. */
	read(uri: string): string | Promise<string>;
}

export interface ResolvedImport {
	decl: ImportDecl;
	uri: string;
}

export interface ModuleRecord {
	uri: string;
	source: string;
	ast: RecipeAST;
	imports: ResolvedImport[];
}

export interface ModuleGraph {
	entry: string;
	modules: Map<string, ModuleRecord>;
	// Topological order, leaves first — the order in which each module's
	// yield must be measured (Phase D.1) so a module's own imports are
	// already measured by the time it's the module being measured.
	order: string[];
	// Every diagnostic raised while loading the graph (MODULE_NOT_FOUND,
	// MODULE_PARSE_ERROR, MODULE_CYCLE, MODULE_DEPTH_EXCEEDED,
	// MODULE_SPECIFIER_INVALID, MODULE_SCHEME_UNSUPPORTED) — each carries a
	// `.uri` naming the module it was raised against.
	diagnostics: Warning[];
}

import { relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { DocumentLink } from "vscode-languageserver";
import { WarningCode } from "@gram-lang/kitchen";
import type { DocumentState } from "../document-state";
import { locToRange } from "../utils/position";

/** The target as a reader would write it from the document: a relative path, or the uri itself off the filesystem. */
function tooltipOf(uri: string, target: string): string {
	if (!uri.startsWith("file:") || !target.startsWith("file:")) return target;
	return relative(dirname(fileURLToPath(uri)), fileURLToPath(target));
}

/**
 * A link on the path of every `@use "..."` (Ctrl+Click opens the base),
 * to the uri the module graph resolved it to: the same resolution as the
 * compilation, aliases (`@/`, `@bases/`) included. A module the graph could
 * not read (`MODULE_NOT_FOUND`, raised on the importing directive) gets no
 * link; one that does not parse keeps its link, since that is where the
 * author has to go.
 */
export function provideDocumentLinks(
	state: DocumentState,
	uri: string,
): DocumentLink[] {
	const graph = state.moduleGraph;
	const record = graph?.modules.get(uri);
	if (!state.ast || !graph || !record) return [];

	// Keyed by specifier, not by position: the graph may come from a refresh
	// slightly older than `state` (getFreshState re-parses the live text
	// against the last graph), so its offsets are not this text's.
	// `MODULE_NOT_FOUND` sits on the graph's own copy of the directive.
	const notFoundAt = new Set(
		graph.diagnostics
			.filter(
				(d) => d.code === WarningCode.MODULE_NOT_FOUND && d.loc?.uri === uri,
			)
			.map((d) => d.loc!.start),
	);
	const missing = new Set<string>();
	const resolved = new Map<string, string>();
	for (const { decl, uri: target } of record.imports) {
		resolved.set(decl.specifier, target);
		if (decl.loc && notFoundAt.has(decl.loc.start)) missing.add(decl.specifier);
	}

	const links: DocumentLink[] = [];
	for (const decl of state.ast.imports) {
		const target = resolved.get(decl.specifier);
		if (!decl.loc || !target || missing.has(decl.specifier)) continue;
		const quote = state.text.indexOf('"', decl.loc.start);
		if (quote < 0 || quote >= decl.loc.end) continue;
		const start = quote + 1;
		links.push({
			range: locToRange(state.lineStarts, {
				start,
				end: start + decl.specifier.length,
			}),
			target,
			tooltip: tooltipOf(uri, target),
		});
	}
	return links;
}

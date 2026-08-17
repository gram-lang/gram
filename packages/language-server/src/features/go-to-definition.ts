import type { Location, Position } from "vscode-languageserver";
import { computeExports } from "@gram-lang/modules";
import type { DocumentState } from "../document-state";
import {
	buildLineIndex,
	locToRange,
	positionToOffset,
} from "../utils/position";
import { collectIntermediates, collectReferences } from "../utils/ast-walker";

/**
 * `&name` resolves to an `@use ... as &name` binding, not a local
 * `->&name` (module-imports RFC §F.1) — jumps into the base file at the
 * section the binding actually exports, using `state.moduleGraph` (already
 * loaded, carries every dependency's own source) rather than re-reading
 * anything. Mirrors `@gram-lang/modules`' own `computeExports`, the exact
 * function `composeRecipe` uses to resolve the same binding at compile time,
 * so "where does &name come from" answers the same way here as it does in
 * the composed output.
 */
function provideCrossFileDefinition(
	state: DocumentState,
	uri: string,
	name: string,
): Location | null {
	const record = state.moduleGraph?.modules.get(uri);
	if (!record) return null;

	for (const { decl, uri: depUri } of record.imports) {
		const binding = decl.bindings.find((b) => b.local === name);
		if (!binding) continue;

		const targetRecord = state.moduleGraph!.modules.get(depUri);
		if (!targetRecord) return null;

		const { sections, exports } = computeExports(targetRecord.ast);
		const exportInfo = exports.get(binding.exported);
		if (!exportInfo) return null;

		const targetSection = sections[exportInfo.sectionIndex];
		const loc = targetSection?.intermediateDecl?.loc ?? targetSection?.loc;
		if (!loc) return null;

		return {
			uri: depUri,
			range: locToRange(buildLineIndex(targetRecord.source), loc),
		};
	}
	return null;
}

export function provideDefinition(
	state: DocumentState,
	uri: string,
	position: Position,
): Location | null {
	if (!state.ast) return null;

	const offset = positionToOffset(state.lineStarts, position);

	const refs = collectReferences(state.ast);
	const ref = refs.find(
		(r) => r.loc && r.loc.start <= offset && offset <= r.loc.end,
	);
	if (!ref) return null;

	const decls = collectIntermediates(state.ast);
	const match = decls.find((d) => d.decl.name === ref.name);
	if (match?.decl.loc) {
		return { uri, range: locToRange(state.lineStarts, match.decl.loc) };
	}

	return provideCrossFileDefinition(state, uri, ref.name);
}

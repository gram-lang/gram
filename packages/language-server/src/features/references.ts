import type { Location, Position } from "vscode-languageserver";
import type { DocumentState } from "../document-state";
import { locToRange, positionToOffset } from "../utils/position";
import {
	collectIntermediates,
	collectReferences,
	collectRelativeTargets,
	findNameAtOffset,
} from "../utils/ast-walker";

function findAllNameLocations(state: DocumentState, name: string): Location[] {
	if (!state.ast) return [];
	const locations: Location[] = [];

	for (const { decl } of collectIntermediates(state.ast)) {
		if (decl.name === name && decl.loc) {
			locations.push({
				uri: "",
				range: locToRange(state.lineStarts, decl.loc),
			});
		}
	}
	for (const ref of collectReferences(state.ast)) {
		if (ref.name === name && ref.loc) {
			locations.push({ uri: "", range: locToRange(state.lineStarts, ref.loc) });
		}
	}
	for (const target of collectRelativeTargets(state.ast, state.text)) {
		if (target.referenceType === "variable" && target.name === name) {
			locations.push({ uri: "", range: locToRange(state.lineStarts, target) });
		}
	}
	return locations;
}

export function provideReferences(
	state: DocumentState,
	position: Position,
): Location[] {
	if (!state.ast) return [];
	const offset = positionToOffset(state.lineStarts, position);
	const found = findNameAtOffset(state.ast, offset, state.text);
	if (!found) return [];
	return findAllNameLocations(state, found.name);
}

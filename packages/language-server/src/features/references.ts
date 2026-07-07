import type { Location, Position } from "vscode-languageserver";
import type { DocumentState } from "../document-state";
import { locToRange, positionToOffset } from "../utils/position";
import {
	collectIntermediates,
	collectReferences,
	findNameAtOffset,
} from "../utils/ast-walker";

export function findAllNameLocations(
	state: DocumentState,
	name: string,
): Location[] {
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
	return locations;
}

export function provideReferences(
	state: DocumentState,
	position: Position,
): Location[] {
	if (!state.ast) return [];
	const offset = positionToOffset(state.lineStarts, position);
	const found = findNameAtOffset(state.ast, offset);
	if (!found) return [];
	return findAllNameLocations(state, found.name);
}

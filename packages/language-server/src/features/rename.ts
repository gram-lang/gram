import type {
	WorkspaceEdit,
	TextEdit,
	Range,
	Position,
	PrepareRenameResult,
} from "vscode-languageserver";
import type { DocumentState } from "../document-state";
import { positionToOffset, offsetToPosition } from "../utils/position";
import {
	collectIntermediates,
	collectReferences,
	findNameAtOffset,
} from "../utils/ast-walker";

// Returns the range covering only the name portion of a decl/ref token.
// For ->&name{} or ->&name: name starts at offset+3 (after "->& ")
// For &name: name starts at offset+1 (after "&")
function nameOnlyRange(
	state: DocumentState,
	tokenStart: number,
	prefixLen: number,
	name: string,
): Range {
	const nameStart = tokenStart + prefixLen;
	const nameEnd = nameStart + name.length;
	return {
		start: offsetToPosition(state.lineStarts, nameStart),
		end: offsetToPosition(state.lineStarts, nameEnd),
	};
}

export function prepareName(
	state: DocumentState,
	position: Position,
): PrepareRenameResult | null {
	if (!state.ast) return null;
	const offset = positionToOffset(state.lineStarts, position);
	const found = findNameAtOffset(state.ast, offset);
	if (!found) return null;

	const decls = collectIntermediates(state.ast);
	const decl = decls.find(
		(d) =>
			d.decl.name === found.name &&
			d.decl.loc &&
			d.decl.loc.start <= offset &&
			offset <= d.decl.loc.end,
	);
	if (decl?.decl.loc) {
		return {
			range: nameOnlyRange(state, decl.decl.loc.start, 3, found.name),
			placeholder: found.name,
		};
	}
	const refs = collectReferences(state.ast);
	const ref = refs.find(
		(r) =>
			r.name === found.name &&
			r.loc &&
			r.loc.start <= offset &&
			offset <= r.loc.end,
	);
	if (ref?.loc) {
		return {
			range: nameOnlyRange(state, ref.loc.start, 1, found.name),
			placeholder: found.name,
		};
	}
	return null;
}

export function provideRename(
	state: DocumentState,
	position: Position,
	newName: string,
	uri: string,
): WorkspaceEdit | null {
	if (!state.ast) return null;
	const offset = positionToOffset(state.lineStarts, position);
	const found = findNameAtOffset(state.ast, offset);
	if (!found) return null;

	const edits: TextEdit[] = [];

	for (const { decl } of collectIntermediates(state.ast)) {
		if (decl.name === found.name && decl.loc) {
			edits.push({
				range: nameOnlyRange(state, decl.loc.start, 3, decl.name),
				newText: newName,
			});
		}
	}
	for (const ref of collectReferences(state.ast)) {
		if (ref.name === found.name && ref.loc) {
			edits.push({
				range: nameOnlyRange(state, ref.loc.start, 1, ref.name),
				newText: newName,
			});
		}
	}

	return { changes: { [uri]: edits } };
}

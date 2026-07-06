import type { Location, Position } from 'vscode-languageserver';
import type { DocumentState } from '../document-state';
import { locToRange, positionToOffset } from '../utils/position';
import { collectIntermediates, collectReferences } from '../utils/ast-walker';

export function provideDefinition(state: DocumentState, position: Position): Location | null {
    if (!state.ast) return null;

    const offset = positionToOffset(state.lineStarts, position);

    // Find which reference is under the cursor
    const refs = collectReferences(state.ast);
    const ref = refs.find(r => r.loc && r.loc.start <= offset && offset <= r.loc.end);
    if (!ref) return null;

    // Find the matching intermediate declaration
    const decls = collectIntermediates(state.ast);
    const match = decls.find(d => d.decl.name === ref.name);
    if (!match?.decl.loc) return null;

    return {
        uri: '', // filled in by the server with the current document URI
        range: locToRange(state.lineStarts, match.decl.loc),
    };
}

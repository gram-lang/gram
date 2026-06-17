import { Hover, MarkupContent, MarkupKind, Position } from 'vscode-languageserver';
import { DocumentState } from '../document-state';
import { positionToOffset } from '../utils/position';
import { collectIntermediates, collectReferences, findStepTextContent } from '../utils/ast-walker';

export function provideHover(state: DocumentState, position: Position): Hover | null {
    if (!state.ast) return null;

    const offset = positionToOffset(state.lineStarts, position);

    const refs = collectReferences(state.ast);
    const ref = refs.find(r => r.loc && r.loc.start <= offset && offset <= r.loc.end);
    if (!ref) return null;

    const decls = collectIntermediates(state.ast);
    const match = decls.find(d => d.decl.name === ref.name);
    if (!match) return null;

    let description = '';
    if (match.step) {
        description = findStepTextContent(match.step);
    } else if (match.section) {
        description = `Section: **${match.section.title ?? '(unnamed)'}**`;
    }

    const contents: MarkupContent = {
        kind: MarkupKind.Markdown,
        value: [`**\`->&${ref.name}\`**`, description].filter(Boolean).join('\n\n'),
    };

    return { contents };
}

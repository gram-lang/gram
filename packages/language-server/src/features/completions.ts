import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { Position } from 'vscode-languageserver';
import { DocumentState } from '../document-state';
import { collectIntermediates } from '../utils/ast-walker';

export function provideCompletions(state: DocumentState, _position: Position): CompletionItem[] {
    if (!state.ast) return [];

    return collectIntermediates(state.ast).map(({ decl }) => ({
        label: decl.name,
        kind: CompletionItemKind.Variable,
        detail: `intermediate preparation: ->&${decl.name}`,
        insertText: decl.name,
    }));
}

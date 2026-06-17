import { CompletionItem, CompletionItemKind, Position } from 'vscode-languageserver';
import { DocumentState } from '../document-state';
import { collectIntermediates } from '../utils/ast-walker';
import { IngredientDB } from '../ingredient-loader';
import { isInsideBraces, provideUnitCompletions } from './completions-units';
import { isAfterAt, provideIngredientCompletions } from './completions-ingredients';

export function provideCompletions(state: DocumentState, position: Position, db: IngredientDB): CompletionItem[] {
    if (!state.ast) return [];

    const lines = state.text.split('\n');
    const line = lines[position.line] ?? '';
    const prefix = line.slice(0, position.character);

    // Inside {quantity unit} → unit completions
    if (isInsideBraces(prefix)) {
        return provideUnitCompletions(prefix);
    }

    // After @ → ingredient completions
    if (isAfterAt(prefix)) {
        return provideIngredientCompletions(db);
    }

    // After & → intermediate reference completions
    return collectIntermediates(state.ast).map(({ decl }) => ({
        label: decl.name,
        kind: CompletionItemKind.Variable,
        detail: `intermediate preparation: ->&${decl.name}`,
        insertText: decl.name,
    }));
}

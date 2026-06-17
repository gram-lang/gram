import { CompletionItem, CompletionItemKind, Position } from 'vscode-languageserver';
import { DocumentState } from '../document-state';
import { collectIntermediates } from '../utils/ast-walker';
import { IngredientDB } from '../ingredient-loader';
import { isInsideBraces, provideUnitCompletions } from './completions-units';
import { isAfterAt, provideIngredientCompletions } from './completions-ingredients';

// True when cursor follows a & used as a reference (&name), NOT a declaration (->&name).
function isAfterReference(prefix: string): boolean {
    const ampIdx = prefix.lastIndexOf('&');
    if (ampIdx === -1) return false;
    // If & is preceded by ->, it is a declaration — don't offer completions here.
    if (ampIdx >= 2 && prefix.slice(ampIdx - 2, ampIdx) === '->') return false;
    // Ensure there is no { or newline between & and cursor (not inside braces or new line).
    const after = prefix.slice(ampIdx + 1);
    return !after.includes('{') && !after.includes('\n');
}

export function provideCompletions(state: DocumentState, position: Position, db: IngredientDB): CompletionItem[] {
    if (!state.ast) return [];

    const lines = state.text.split('\n');
    const line = lines[position.line] ?? '';
    const prefix = line.slice(0, position.character);

    // Inside {quantity unit} → unit completions
    if (isInsideBraces(prefix)) {
        return provideUnitCompletions(prefix);
    }

    // After @ (with optional modifier: @?, @-, @*, @&, @=) → ingredient completions
    if (isAfterAt(prefix)) {
        return provideIngredientCompletions(db);
    }

    // After &name (reference, not declaration) → intermediate completions
    if (isAfterReference(prefix)) {
        return collectIntermediates(state.ast).map(({ decl }) => ({
            label: decl.name,
            kind: CompletionItemKind.Variable,
            detail: `intermediate: ->&${decl.name}`,
            // Multi-word names require {} in the reference syntax (&name{})
            insertText: decl.name.includes(' ') ? `${decl.name}{}` : decl.name,
        }));
    }

    return [];
}

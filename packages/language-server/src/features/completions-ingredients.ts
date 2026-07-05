import { CompletionItem, CompletionItemKind, MarkupKind } from 'vscode-languageserver';
import { IngredientDB, allIngredientCompletionLabels } from '../ingredient-loader';

export function isAfterAt(prefix: string): boolean {
    const atIdx = prefix.lastIndexOf('@');
    if (atIdx === -1) return false;
    // No newline or { between @ and cursor
    const after = prefix.slice(atIdx + 1);
    return !after.includes('{') && !after.includes('\n');
}

export function provideIngredientCompletions(db: IngredientDB): CompletionItem[] {
    if (Object.keys(db).length === 0) return [];

    return allIngredientCompletionLabels(db).map(({ label, canonical, entry }) => {
        const lines: string[] = [];
        if (entry.name !== label) lines.push(`_${entry.name}_`);
        if (entry.nutrition) {
            const n = entry.nutrition;
            lines.push(`${n.calories} kcal/100g · P: ${n.protein}g · C: ${n.carbs}g · F: ${n.fat}g`);
        }
        return {
            label,
            kind: CompletionItemKind.Value,
            detail: canonical !== label ? canonical : undefined,
            documentation: lines.length > 0 ? { kind: MarkupKind.Markdown, value: lines.join('\n\n') } : undefined,
            // Multi-word names require {} to delimit the name in Gram syntax (@name{qty})
            insertText: label.includes(' ') ? `${label}{}` : label,
        };
    });
}

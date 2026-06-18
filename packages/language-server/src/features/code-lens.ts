import { CodeLens, Command, Range, Position } from 'vscode-languageserver';
import { DocumentState } from '../document-state';

export function provideCodeLenses(state: DocumentState): CodeLens[] {
    const lenses: CodeLens[] = [];
    
    // Always put it at the very top of the document
    const topRange = Range.create(Position.create(0, 0), Position.create(0, 0));

    // Preview Command
    lenses.push({
        range: topRange,
        command: Command.create('▶ Aperçu', 'gram.showPreview')
    });

    // Nutrition Command
    lenses.push({
        range: topRange,
        command: Command.create('📊 Macros', 'gram.showNutrition')
    });

    return lenses;
}
